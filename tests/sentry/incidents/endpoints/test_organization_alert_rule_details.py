from __future__ import absolute_import

import six

from copy import deepcopy

from exam import fixture


from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.auth.access import OrganizationGlobalAccess
from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.incidents.models import AlertRule, AlertRuleStatus, Incident, IncidentStatus
from sentry.testutils import APITestCase
from tests.sentry.incidents.endpoints.test_organization_alert_rule_index import AlertRuleBase


class AlertRuleDetailsBase(AlertRuleBase):
    endpoint = "sentry-api-0-organization-alert-rule-details"

    def new_alert_rule(self, data=None):
        if data is None:
            data = deepcopy(self.alert_rule_dict)

        serializer = AlertRuleSerializer(
            context={
                "organization": self.organization,
                "access": OrganizationGlobalAccess(self.organization),
            },
            data=data,
        )

        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        return alert_rule

    def get_serialized_alert_rule(self):
        # Only call after calling self.alert_rule to create it.
        original_endpoint = self.endpoint
        original_method = self.method
        self.endpoint = "sentry-api-0-organization-alert-rules"
        self.method = "get"
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug)
            assert len(resp.data) >= 1
            serialized_alert_rule = resp.data[0]
            if serialized_alert_rule["environment"]:
                serialized_alert_rule["environment"] = serialized_alert_rule["environment"][0]
            else:
                serialized_alert_rule.pop("environment", None)
        self.endpoint = original_endpoint
        self.method = original_method
        return serialized_alert_rule

    @fixture
    def alert_rule(self):
        return self.new_alert_rule(data=deepcopy(self.alert_rule_dict))

    def test_invalid_rule_id(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, 1234)

        assert resp.status_code == 404

    def test_permissions(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.alert_rule.id)

        assert resp.status_code == 403

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.alert_rule.id)
        assert resp.status_code == 404


class AlertRuleDetailsGetEndpointTest(AlertRuleDetailsBase, APITestCase):
    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug, self.alert_rule.id)

        assert resp.data == serialize(self.alert_rule, serializer=DetailedAlertRuleSerializer())


class AlertRuleDetailsPutEndpointTest(AlertRuleDetailsBase, APITestCase):
    method = "put"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["name"] = "what"

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.name = "what"
        assert resp.data == serialize(alert_rule)
        assert resp.data["name"] == "what"

    def test_sentry_app(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        sentry_app = self.create_sentry_app(
            name="foo", organization=self.organization, is_alertable=True, verify_install=False
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["name"] = "ValidSentryAppTestRule"
        serialized_alert_rule["triggers"][0]["actions"][0] = {
            "type": "sentry_app",
            "targetType": "sentry_app",
            "targetIdentifier": sentry_app.id,
            "sentryAppId": sentry_app.id,
        }

        with self.feature(
            ["organizations:incidents", "organizations:integrations-sentry-app-metric-alerts"]
        ):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.name = "ValidSentryAppTestRule"
        assert resp.data == serialize(alert_rule)
        assert resp.data["triggers"][0]["actions"][0]["sentryAppId"] == sentry_app.id

    def test_not_updated_fields(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        existing_sub = self.alert_rule.snuba_query.subscriptions.first()

        # Alert rule should be exactly the same
        assert resp.data == serialize(self.alert_rule)
        # If the aggregate changed we'd have a new subscription, validate that
        # it hasn't changed explicitly
        updated_sub = AlertRule.objects.get(id=self.alert_rule.id).snuba_query.subscriptions.first()
        assert updated_sub.subscription_id == existing_sub.subscription_id

    def test_update_trigger_label_to_unallowed_value(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)

        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["triggers"][0]["label"] = "goodbye"

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, status_code=400, **serialized_alert_rule
            )
            assert resp.data == {"nonFieldErrors": ['Trigger 1 must be labeled "critical"']}
            serialized_alert_rule["triggers"][0]["label"] = "critical"
            serialized_alert_rule["triggers"][1]["label"] = "goodbye"
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, status_code=400, **serialized_alert_rule
            )
            assert resp.data == {"nonFieldErrors": ['Trigger 2 must be labeled "warning"']}

    def test_update_trigger_alert_threshold(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["triggers"][1]["alertThreshold"] = 125
        serialized_alert_rule["name"] = "AUniqueName"

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert resp.data["name"] == "AUniqueName"
        assert resp.data["triggers"][1]["alertThreshold"] == 125

    def test_delete_resolve_alert_threshold(self):
        # This is a test to make sure we can remove a resolveThreshold after it has been set.
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        alert_rule.update(resolve_threshold=75)
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["resolveThreshold"] = None
        serialized_alert_rule["name"] = "AUniqueName"

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert resp.data["name"] == "AUniqueName"
        assert resp.data["resolveThreshold"] is None

    def test_update_resolve_alert_threshold(self):
        # This is a test to make sure we can remove a resolveThreshold after it has been set.
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        alert_rule.update(resolve_threshold=75)
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["resolveThreshold"] = 75
        serialized_alert_rule["name"] = "AUniqueName"

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )
        assert resp.data["name"] == "AUniqueName"
        assert resp.data["resolveThreshold"] == 75

    def test_delete_trigger(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["triggers"].pop(1)

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert len(resp.data["triggers"]) == 1

    def test_delete_action(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["triggers"][1]["actions"].pop(1)

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert len(resp.data["triggers"][1]["actions"]) == 1

        # Delete the last one.
        serialized_alert_rule["triggers"][1]["actions"].pop()

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert len(resp.data["triggers"][1]["actions"]) == 0

    def test_update_trigger_action_type(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)

        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        # Then we send it back with one of the actions changed:
        serialized_alert_rule["triggers"][0]["actions"][0]["targetType"] = "user"
        serialized_alert_rule["triggers"][0]["actions"][0]["targetIdentifier"] = self.user.id

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        # And it comes back successfully changed:
        assert resp.data["triggers"][0]["actions"][0]["targetType"] == "user"
        assert resp.data["triggers"][0]["actions"][0]["targetIdentifier"] == six.text_type(
            self.user.id
        )

        # And make sure we still only have two triggers, the first with 1 action and the second with 2 actions
        # This is ensures they were updated and not new ones created, etc.
        assert len(resp.data["triggers"]) == 2
        assert len(resp.data["triggers"][0]["actions"]) == 1
        assert len(resp.data["triggers"][1]["actions"]) == 2

    def test_invalid_thresholds(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["triggers"][0]["alertThreshold"] = 50  # Invalid
        serialized_alert_rule.pop("resolveThreshold")
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug, alert_rule.id, status_code=400, **serialized_alert_rule
            )

    def test_update_snapshot(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        # Archive the rule so that the endpoint 404's, without this, it should 200 and the test would fail:
        alert_rule.status = AlertRuleStatus.SNAPSHOT.value
        alert_rule.save()

        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug, alert_rule.id, status_code=404, **serialized_alert_rule
            )


class AlertRuleDetailsDeleteEndpointTest(AlertRuleDetailsBase, APITestCase):
    method = "delete"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

        with self.feature("organizations:incidents"):
            self.get_valid_response(self.organization.slug, self.alert_rule.id, status_code=204)

        assert not AlertRule.objects.filter(id=self.alert_rule.id).exists()
        assert not AlertRule.objects_with_snapshots.filter(name=self.alert_rule.name).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=self.alert_rule.id).exists()

    def test_snapshot_and_create_new_with_same_name(self):
        with self.tasks():
            self.create_member(
                user=self.user, organization=self.organization, role="owner", teams=[self.team]
            )
            self.login_as(self.user)

            # We attach the rule to an incident so the rule is snapshotted instead of deleted.
            incident = self.create_incident(alert_rule=self.alert_rule)

            with self.feature("organizations:incidents"):
                self.get_valid_response(self.organization.slug, self.alert_rule.id, status_code=204)

            alert_rule = AlertRule.objects_with_snapshots.get(id=self.alert_rule.id)

            assert not AlertRule.objects.filter(id=alert_rule.id).exists()
            assert AlertRule.objects_with_snapshots.filter(id=alert_rule.id).exists()
            assert alert_rule.status == AlertRuleStatus.SNAPSHOT.value

            # We also confirm that the incident is automatically resolved.
            assert Incident.objects.get(id=incident.id).status == IncidentStatus.CLOSED.value

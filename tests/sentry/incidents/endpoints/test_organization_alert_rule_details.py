from copy import deepcopy
from functools import cached_property

import responses
from django.conf import settings

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.auth.access import OrganizationGlobalAccess
from sentry.incidents.models import (
    AlertRule,
    AlertRuleStatus,
    AlertRuleTriggerAction,
    Incident,
    IncidentStatus,
)
from sentry.incidents.serializers import AlertRuleSerializer
from sentry.models import AuditLogEntry, OrganizationMemberTeam
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
                "access": OrganizationGlobalAccess(self.organization, settings.SENTRY_SCOPES),
                "user": self.user,
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
            resp = self.get_success_response(self.organization.slug)
            assert len(resp.data) >= 1
            serialized_alert_rule = resp.data[0]
            if serialized_alert_rule["environment"]:
                serialized_alert_rule["environment"] = serialized_alert_rule["environment"][0]
            else:
                serialized_alert_rule.pop("environment", None)
        self.endpoint = original_endpoint
        self.method = original_method
        return serialized_alert_rule

    @cached_property
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
            resp = self.get_success_response(self.organization.slug, self.alert_rule.id)

        assert resp.data == serialize(self.alert_rule, serializer=DetailedAlertRuleSerializer())

    def test_expand_latest_incident(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        incident = self.create_incident(
            organization=self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=self.alert_rule,
            status=IncidentStatus.CRITICAL.value,
        )
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.alert_rule.id, expand=["latestIncident"]
            )
            no_expand_resp = self.get_success_response(self.organization.slug, self.alert_rule.id)

        assert resp.data["latestIncident"] is not None
        assert resp.data["latestIncident"]["id"] == str(incident.id)
        assert "latestIncident" not in no_expand_resp.data

    @responses.activate
    def test_with_unresponsive_sentryapp(self):
        self.superuser = self.create_user("admin@localhost", is_superuser=True)
        self.login_as(user=self.superuser)
        self.create_team(organization=self.organization, members=[self.superuser])

        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.superuser
        )
        self.rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(self.rule, "hi", 1000)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger,
            target_identifier=self.sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            sentry_app_config=[
                {"name": "title", "value": "An alert"},
                {"summary": "Something happened here..."},
                {"name": "points", "value": "3"},
                {"name": "assignee", "value": "Nisanthan"},
            ],
        )

        responses.add(responses.GET, "http://example.com/sentry/members", json={}, status=404)
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.rule.id)

        assert len(responses.calls) == 1

        assert resp.status_code == 200
        # Returns errors while fetching
        assert len(resp.data["errors"]) == 1
        assert resp.data["errors"][0] == {
            "detail": "Could not fetch details from Super Awesome App"
        }

        # Disables the SentryApp
        assert (
            resp.data["triggers"][0]["actions"][0]["sentryAppInstallationUuid"]
            == self.installation.uuid
        )
        assert resp.data["triggers"][0]["actions"][0]["disabled"] is True


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
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.name = "what"
        alert_rule.date_modified = resp.data["dateModified"]
        assert resp.data == serialize(alert_rule)
        assert resp.data["name"] == "what"
        assert resp.data["dateModified"] > serialized_alert_rule["dateModified"]

        audit_log_entry = AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("ALERT_RULE_EDIT"), target_object=alert_rule.id
        )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )

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

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.refresh_from_db()
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
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        existing_sub = self.alert_rule.snuba_query.subscriptions.first()

        alert_rule.refresh_from_db()
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
            resp = self.get_error_response(
                self.organization.slug, alert_rule.id, status_code=400, **serialized_alert_rule
            )
            assert resp.data == {"nonFieldErrors": ['Trigger 1 must be labeled "critical"']}
            serialized_alert_rule["triggers"][0]["label"] = "critical"
            serialized_alert_rule["triggers"][1]["label"] = "goodbye"
            resp = self.get_error_response(
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
            resp = self.get_success_response(
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
            resp = self.get_success_response(
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
            resp = self.get_success_response(
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
            resp = self.get_success_response(
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
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert len(resp.data["triggers"][1]["actions"]) == 1

        # Delete the last one.
        serialized_alert_rule["triggers"][1]["actions"].pop()

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
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
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        # And it comes back successfully changed:
        assert resp.data["triggers"][0]["actions"][0]["targetType"] == "user"
        assert resp.data["triggers"][0]["actions"][0]["targetIdentifier"] == str(self.user.id)

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
            self.get_error_response(
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
            self.get_error_response(
                self.organization.slug, alert_rule.id, status_code=404, **serialized_alert_rule
            )

    def test_no_owner(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["owner"] = None

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.refresh_from_db()
        assert resp.data == serialize(alert_rule, self.user)
        assert resp.data["owner"] is None

    def test_team_permission(self):
        # Test ensures you can only edit alerts owned by your team or no one.

        om = self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        alert_rule.owner = self.team.actor
        alert_rule.save()
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        OrganizationMemberTeam.objects.filter(
            organizationmember__user=self.user,
            team=self.team,
        ).delete()
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, alert_rule.id, **serialized_alert_rule)
        assert resp.status_code == 403
        self.create_team_membership(team=self.team, member=om)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.refresh_from_db()
        assert resp.data == serialize(alert_rule, self.user)


class AlertRuleDetailsDeleteEndpointTest(AlertRuleDetailsBase, APITestCase):
    method = "delete"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.alert_rule.id, status_code=204
            )

        assert not AlertRule.objects.filter(id=self.alert_rule.id).exists()
        assert not AlertRule.objects_with_snapshots.filter(name=self.alert_rule.name).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=self.alert_rule.id).exists()

        audit_log_entry = AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("ALERT_RULE_REMOVE"), target_object=self.alert_rule.id
        )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        self.get_success_response(self.organization.slug, self.alert_rule.id, status_code=204)

    def test_snapshot_and_create_new_with_same_name(self):
        with self.tasks():
            self.create_member(
                user=self.user, organization=self.organization, role="owner", teams=[self.team]
            )
            self.login_as(self.user)

            # We attach the rule to an incident so the rule is snapshotted instead of deleted.
            incident = self.create_incident(alert_rule=self.alert_rule)

            with self.feature("organizations:incidents"):
                self.get_success_response(
                    self.organization.slug, self.alert_rule.id, status_code=204
                )

            alert_rule = AlertRule.objects_with_snapshots.get(id=self.alert_rule.id)

            assert not AlertRule.objects.filter(id=alert_rule.id).exists()
            assert AlertRule.objects_with_snapshots.filter(id=alert_rule.id).exists()
            assert alert_rule.status == AlertRuleStatus.SNAPSHOT.value

            # We also confirm that the incident is automatically resolved.
            assert Incident.objects.get(id=incident.id).status == IncidentStatus.CLOSED.value

    def test_team_permission(self):
        # Test ensures you can only delete alerts owned by your team or no one.
        om = self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        alert_rule.owner = self.team.actor
        alert_rule.save()
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        OrganizationMemberTeam.objects.filter(
            organizationmember__user=self.user,
            team=self.team,
        ).delete()
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, alert_rule.id)
        assert resp.status_code == 403
        self.create_team_membership(team=self.team, member=om)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, alert_rule.id, status_code=204)

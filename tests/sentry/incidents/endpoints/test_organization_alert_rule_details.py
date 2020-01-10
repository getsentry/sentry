from __future__ import absolute_import

from copy import deepcopy

from exam import fixture

from django.forms.models import model_to_dict

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.auth.access import OrganizationGlobalAccess
from sentry.incidents.endpoints.serializers import UnifiedAlertRuleSerializer
from sentry.incidents.logic import create_alert_rule
from sentry.incidents.models import AlertRule
from sentry.snuba.models import QueryAggregations
from sentry.testutils import APITestCase


class AlertRuleDetailsBase(object):
    endpoint = "sentry-api-0-organization-alert-rule-details"

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    @fixture
    def alert_rule_dict(self):
        return {
            "aggregation": 0,
            "aggregations": [0],
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "JustAValidTestRule",
             "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 200,
                    "resolveThreshold": 300,
                    "thresholdType": 0,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                },
                {
                    "label": "warning",
                    "alertThreshold": 150,
                    "resolveThreshold": 300,
                    "thresholdType": 0,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                        {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                    ],
                },
            ]
            # **self.trigger_dict,
        }
        # .update(**self.trigger_dict)

    @fixture
    def alert_rule(self):
        serializer = UnifiedAlertRuleSerializer(
            context={
                "organization": self.organization,
                "access": OrganizationGlobalAccess(self.organization)
            },
            data=deepcopy(self.alert_rule_dict)
        )

        assert serializer.is_valid()
        alert_rule = serializer.save()
        return alert_rule

    # @fixture
    # def trigger_dict(self):
    #     return {
    #         "triggers": [
    #             {
    #                 "label": "critical",
    #                 "alertThreshold": 200,
    #                 "resolveThreshold": 300,
    #                 "thresholdType": 0,
    #                 "actions": [
    #                     {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
    #                 ],
    #             },
    #             {
    #                 "label": "warning",
    #                 "alertThreshold": 150,
    #                 "resolveThreshold": 300,
    #                 "thresholdType": 0,
    #                 "actions": [
    #                     {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
    #                     {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
    #                 ],
    #             },
    #         ]
    #     }

    # @fixture
    # def trigger(self):
    #     return create_alert_rule_trigger(
    #         self.alert_rule, "hello", AlertRuleThresholdType.ABOVE, 1000, 400
    #     )

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

    def test_simple_put(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            self.alert_rule_dict["name"] = "what"
            resp = self.get_valid_response(self.organization.slug, self.alert_rule.id, **self.alert_rule_dict)

        assert resp.data == serialize(self.alert_rule)
        assert resp.data["name"] == "what"

    def test_not_updated_fields(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, self.alert_rule.id, **self.alert_rule_dict
            )

        existing_sub = self.alert_rule.query_subscriptions.first()

        # Alert rule should be exactly the same
        assert resp.data == serialize(self.alert_rule)
        # If the aggregation changed we'd have a new subscription, validate that
        # it hasn't changed explicitly
        # updated_sub = AlertRule.objects.get(id=self.alert_rule.id).query_subscriptions.first()
        # assert updated_sub.subscription_id == existing_sub.subscription_id


    def test_update_trigger_label(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, self.alert_rule.id, self.trigger.id, label="what"
            )

        self.trigger.label = "what"
        assert resp.data == serialize(self.trigger)
        assert resp.data["label"] == "what"

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
        assert not AlertRule.objects_with_deleted.filter(name=self.alert_rule.name)
        assert AlertRule.objects_with_deleted.filter(id=self.alert_rule.id).exists()

from __future__ import absolute_import

from exam import fixture

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule_trigger import DetailedAlertRuleTriggerSerializer
from sentry.incidents.logic import create_alert_rule, create_alert_rule_trigger
from sentry.incidents.models import AlertRuleThresholdType, AlertRuleTrigger
from sentry.snuba.models import QueryAggregations
from sentry.testutils import APITestCase


class AlertRuleTriggerDetailsBase(object):
    endpoint = "sentry-api-0-organization-alert-rule-trigger-details"

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
    def alert_rule(self):
        return create_alert_rule(
            self.organization,
            [self.project],
            "hello",
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )

    @fixture
    def trigger(self):
        return create_alert_rule_trigger(
            self.alert_rule, "hello", AlertRuleThresholdType.ABOVE, 1000, 400
        )

    def test_invalid_trigger_id(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.alert_rule.id, 1234)

        assert resp.status_code == 404

    def test_permissions(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.alert_rule.id, self.trigger.id)

        assert resp.status_code == 403

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.alert_rule.id, self.trigger.id)
        assert resp.status_code == 404


class AlertRuleTriggerDetailsGetEndpointTest(AlertRuleTriggerDetailsBase, APITestCase):
    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, self.alert_rule.id, self.trigger.id
            )

        assert resp.data == serialize(self.trigger, serializer=DetailedAlertRuleTriggerSerializer())


class AlertRuleTriggerDetailsPutEndpointTest(AlertRuleTriggerDetailsBase, APITestCase):
    method = "put"

    def test_simple(self):
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

    def test_not_updated_fields(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, self.alert_rule.id, self.trigger.id
            )

        # Alert rule should be exactly the same
        assert resp.data == serialize(self.trigger)


class AlertRuleTriggerDetailsDeleteEndpointTest(AlertRuleTriggerDetailsBase, APITestCase):
    method = "delete"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug, self.alert_rule.id, self.trigger.id, status_code=204
            )

        assert not AlertRuleTrigger.objects.filter(id=self.trigger.id).exists()

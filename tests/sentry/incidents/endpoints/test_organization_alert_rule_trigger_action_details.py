from __future__ import absolute_import

from exam import fixture

from sentry.api.serializers import serialize
from sentry.incidents.logic import (
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
)
from sentry.incidents.models import AlertRuleThresholdType, AlertRuleTriggerAction
from sentry.snuba.models import QueryAggregations
from sentry.testutils import APITestCase


class AlertRuleTriggerActionDetailsBase(object):
    endpoint = "sentry-api-0-organization-alert-rule-trigger-action-details"

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

    @fixture
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            "hello",
        )

    def test_invalid_action_id(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_response(
                self.organization.slug, self.alert_rule.id, self.trigger.id, 1234
            )

        assert resp.status_code == 404

    def test_permissions(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(
                self.organization.slug, self.alert_rule.id, self.trigger.id, self.action.id
            )

        assert resp.status_code == 403

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(
            self.organization.slug, self.alert_rule.id, self.trigger.id, self.action.id
        )
        assert resp.status_code == 404


class AlertRuleTriggerActionDetailsGetEndpointTest(AlertRuleTriggerActionDetailsBase, APITestCase):
    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_response(
                self.organization.slug, self.alert_rule.id, self.trigger.id, self.action.id
            )

        assert resp.data == serialize(self.action)


class AlertRuleTriggerActionDetailsPutEndpointTest(AlertRuleTriggerActionDetailsBase, APITestCase):
    method = "put"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_response(
                self.organization.slug,
                self.alert_rule.id,
                self.trigger.id,
                self.action.id,
                target_identifier="wat",
            )

        self.action.target_identifier = "wat"
        assert resp.data == serialize(self.action)
        assert resp.data["targetIdentifier"] == "wat"

    def test_not_updated_fields(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                self.alert_rule.id,
                self.trigger.id,
                self.action.id,
                type=self.action.type,
            )

        # Alert rule should be exactly the same
        assert resp.data == serialize(self.action)


class AlertRuleTriggerActionDetailsDeleteEndpointTest(
    AlertRuleTriggerActionDetailsBase, APITestCase
):
    method = "delete"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug,
                self.alert_rule.id,
                self.trigger.id,
                self.action.id,
                status_code=204,
            )

        assert not AlertRuleTriggerAction.objects.filter(id=self.action.id).exists()

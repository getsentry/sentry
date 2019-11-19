from __future__ import absolute_import

import six
from exam import fixture
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers import action_target_type_to_string
from sentry.incidents.logic import create_alert_rule_trigger, create_alert_rule_trigger_action
from sentry.incidents.models import AlertRuleThresholdType, AlertRuleTriggerAction
from sentry.testutils import APITestCase


class AlertRuleTriggerActionIndexBase(object):
    endpoint = "sentry-api-0-organization-alert-rules-trigger-actions"

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
        return self.create_alert_rule()

    @fixture
    def trigger(self):
        return create_alert_rule_trigger(
            self.alert_rule, "test", AlertRuleThresholdType.ABOVE, 1000, 400
        )


class AlertRuleTriggerActionListEndpointTest(AlertRuleTriggerActionIndexBase, APITestCase):
    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        action = create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            "hello",
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, self.alert_rule.id, self.trigger.id
            )

        assert resp.data == serialize([action])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.alert_rule.id, self.trigger.id)
        assert resp.status_code == 404


@freeze_time()
class AlertRuleTriggerActionCreateEndpointTest(AlertRuleTriggerActionIndexBase, APITestCase):
    method = "post"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                self.alert_rule.id,
                self.trigger.id,
                type=AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.EMAIL
                ).slug,
                target_type=action_target_type_to_string[AlertRuleTriggerAction.TargetType.USER],
                target_identifier=six.text_type(self.user.id),
                status_code=201,
            )
        assert "id" in resp.data
        action = AlertRuleTriggerAction.objects.get(id=resp.data["id"])
        assert resp.data == serialize(action, self.user)

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.alert_rule.id, self.trigger.id)
        assert resp.status_code == 404

    def test_no_perms(self):
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.alert_rule.id, self.trigger.id)
        assert resp.status_code == 403

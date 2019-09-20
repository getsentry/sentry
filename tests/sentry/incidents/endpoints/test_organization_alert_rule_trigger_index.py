from __future__ import absolute_import

from exam import fixture
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_alert_rule_trigger
from sentry.incidents.models import AlertRuleThresholdType, AlertRuleTrigger
from sentry.testutils import APITestCase


class AlertRuleTriggerListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rules-triggers"

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(
            alert_rule, "test", AlertRuleThresholdType.ABOVE, 1000, 400
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug, alert_rule.id)

        assert resp.data == serialize([trigger])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.create_alert_rule().id)
        assert resp.status_code == 404


@freeze_time()
class AlertRuleTriggerCreateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rules-triggers"
    method = "post"

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

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                self.alert_rule.id,
                label="an alert",
                thresholdType=1,
                alertThreshold=1000,
                resolveThreshold=300,
                status_code=201,
            )
        assert "id" in resp.data
        trigger = AlertRuleTrigger.objects.get(id=resp.data["id"])
        assert resp.data == serialize(trigger, self.user)

    def test_invalid_excluded_projects(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                self.alert_rule.id,
                label="an alert",
                thresholdType=1,
                alertThreshold=1000,
                resolveThreshold=300,
                excludedProjects=[
                    self.project.slug,
                    self.create_project(organization=self.create_organization()).slug,
                ],
                status_code=400,
            )
        assert resp.data == {"excludedProjects": [u"Invalid project"]}

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.alert_rule.id)
        assert resp.status_code == 404

    def test_no_perms(self):
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.alert_rule.id)
        assert resp.status_code == 403

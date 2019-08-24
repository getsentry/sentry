from __future__ import absolute_import

from exam import fixture
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_alert_rule
from sentry.incidents.models import AlertRule, AlertRuleAggregations, AlertRuleThresholdType
from sentry.testutils import APITestCase


class AlertRuleListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_empty(self):
        self.create_team(organization=self.organization, members=[self.user])

    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = create_alert_rule(
            self.project,
            "hello",
            AlertRuleThresholdType.ABOVE,
            "level:error",
            [AlertRuleAggregations.TOTAL],
            10,
            1000,
            400,
            1,
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug, self.project.slug)

        assert resp.data == serialize([alert_rule])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 404


@freeze_time()
class AlertRuleCreateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"
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

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        name = "an alert"
        threshold_type = 1
        query = "hi"
        aggregations = [0]
        time_window = 10
        alert_threshold = 1000
        resolve_threshold = 300
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                self.project.slug,
                name=name,
                thresholdType=threshold_type,
                query=query,
                aggregations=aggregations,
                timeWindow=time_window,
                alertThreshold=alert_threshold,
                resolveThreshold=resolve_threshold,
                status_code=201,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 404

    def test_no_perms(self):
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 403

from __future__ import absolute_import

from exam import fixture
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_alert_rule
from sentry.incidents.models import AlertRule
from sentry.snuba.models import QueryAggregations
from sentry.testutils import APITestCase


class AlertRuleListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rules"

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
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "hello",
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug)

        assert resp.data == serialize([alert_rule])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404


@freeze_time()
class AlertRuleCreateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rules"
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

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                projects=[self.project.slug],
                name="an alert",
                thresholdType=1,
                query="hi",
                aggregation=0,
                timeWindow=10,
                alertThreshold=1000,
                resolveThreshold=300,
                status_code=201,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_unified_create(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

        rule_two_triggers_two_actions = {
            "aggregation": 0,
            "aggregations": [0],
            "query": "",
            "timeWindow": "300",
            "triggers": [
                {
                    "label": "WARNING",
                    "alertThreshold": 200,
                    "resolveThreshold": 300,
                    "thresholdType": 1,
                    "actions": [{"type": "email", "targetType": "team", "targetIdentifier": "2"}],
                },
                {
                    "label": "CRITICAL",
                    "alertThreshold": 150,
                    "resolveThreshold": 300,
                    "thresholdType": 1,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": "2"},
                        {"type": "email", "targetType": "user", "targetIdentifier": "1"},
                    ],
                },
            ],
            "projects": [self.project.slug],
            "name": "JustATestRule",
        }
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, status_code=201, **rule_two_triggers_two_actions
            )

        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_invalid_projects(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                projects=[
                    self.project.slug,
                    self.create_project(organization=self.create_organization()).slug,
                ],
                name="an alert",
                thresholdType=1,
                query="hi",
                aggregation=0,
                timeWindow=10,
                alertThreshold=1000,
                resolveThreshold=300,
                status_code=400,
            )
        assert resp.data == {"projects": [u"Invalid project"]}

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404

    def test_no_perms(self):
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 403

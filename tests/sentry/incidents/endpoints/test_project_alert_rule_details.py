from __future__ import absolute_import

from exam import fixture

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_alert_rule
from sentry.incidents.models import AlertRule
from sentry.snuba.models import QueryAggregations
from sentry.testutils import APITestCase


class AlertRuleDetailsBase(object):
    endpoint = "sentry-api-0-project-alert-rule-details"

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

    def test_invalid_rule_id(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.project.slug, 1234)

        assert resp.status_code == 404

    def test_permissions(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.project.slug, self.alert_rule.id)

        assert resp.status_code == 403

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug, self.alert_rule.id)
        assert resp.status_code == 404


class AlertRuleDetailsGetEndpointTest(AlertRuleDetailsBase, APITestCase):
    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, self.project.slug, self.alert_rule.id
            )

        assert resp.data == serialize(self.alert_rule)


class AlertRuleDetailsPutEndpointTest(AlertRuleDetailsBase, APITestCase):
    method = "put"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, name="what"
            )

        self.alert_rule.name = "what"
        assert resp.data == serialize(self.alert_rule)
        assert resp.data["name"] == "what"

    def test_not_updated_fields(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.organization.slug,
                self.project.slug,
                self.alert_rule.id,
                aggregation=self.alert_rule.aggregation,
            )

        existing_sub = self.alert_rule.query_subscriptions.first()

        # Alert rule should be exactly the same
        assert resp.data == serialize(self.alert_rule)
        # If the aggregation changed we'd have a new subscription, validate that
        # it hasn't changed explicitly
        updated_sub = AlertRule.objects.get(id=self.alert_rule.id).query_subscriptions.first()
        assert updated_sub.subscription_id == existing_sub.subscription_id


class AlertRuleDetailsDeleteEndpointTest(AlertRuleDetailsBase, APITestCase):
    method = "delete"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, status_code=204
            )

        assert not AlertRule.objects.filter(id=self.alert_rule.id).exists()
        assert not AlertRule.objects_with_deleted.filter(name=self.alert_rule.name)
        assert AlertRule.objects_with_deleted.filter(id=self.alert_rule.id).exists()

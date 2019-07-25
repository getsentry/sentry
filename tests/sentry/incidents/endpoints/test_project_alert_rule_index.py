from __future__ import absolute_import

from exam import fixture
from freezegun import freeze_time

from sentry.incidents.models import AlertRule
from sentry.testutils import APITestCase


@freeze_time()
class IncidentCreateEndpointTest(APITestCase):
    endpoint = 'sentry-api-0-project-alert-rules'
    method = 'post'

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
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        name = 'an alert'
        threshold_type = 1
        query = 'hi'
        aggregations = [0]
        time_window = 10
        alert_threshold = 1000
        resolve_threshold = 300
        with self.feature('organizations:incidents'):
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
        assert 'id' in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data['id'])
        assert alert_rule.name == name
        assert alert_rule.threshold_type == threshold_type
        assert alert_rule.query == query
        assert alert_rule.aggregations == aggregations
        assert alert_rule.time_window == time_window
        assert alert_rule.alert_threshold == alert_threshold
        assert alert_rule.resolve_threshold == resolve_threshold

    def test_no_feature(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 404

    def test_no_perms(self):
        self.create_member(
            user=self.user,
            organization=self.organization,
            role='member',
            teams=[self.team],
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 403

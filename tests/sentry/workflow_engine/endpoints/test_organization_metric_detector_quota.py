from unittest import mock

from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
@with_feature("organizations:workflow-engine-metric-detector-limit")
@mock.patch("sentry.quotas.backend.get_metric_detector_limit", return_value=3)
class OrganizationMetricDetectorQuotaTest(APITestCase):
    endpoint = "sentry-api-0-organization-metric-detector-quota"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_counts_enabled_metric_detectors(self, _limit: mock.MagicMock) -> None:
        self.create_detector(project=self.project, type=MetricIssue.slug, enabled=True)
        self.create_detector(project=self.project, type=MetricIssue.slug, enabled=False)

        response = self.get_success_response(self.organization.slug)

        assert response.data == {"count": 1, "limit": 3, "hasReachedLimit": False}

    def test_has_reached_limit(self, _limit: mock.MagicMock) -> None:
        for _ in range(3):
            self.create_detector(project=self.project, type=MetricIssue.slug, enabled=True)

        response = self.get_success_response(self.organization.slug)

        assert response.data == {"count": 3, "limit": 3, "hasReachedLimit": True}

    def test_unlimited_returns_sentinel(self, limit: mock.MagicMock) -> None:
        limit.return_value = -1
        self.create_detector(project=self.project, type=MetricIssue.slug, enabled=True)

        response = self.get_success_response(self.organization.slug)

        assert response.data == {"count": -1, "limit": -1, "hasReachedLimit": False}

    def test_counts_projects_the_user_is_not_a_member_of(self, _limit: mock.MagicMock) -> None:
        member_team = self.create_team(organization=self.organization)
        other_team = self.create_team(organization=self.organization)
        other_project = self.create_project(organization=self.organization, teams=[other_team])
        self.create_detector(project=other_project, type=MetricIssue.slug, enabled=True)
        member = self.create_user()
        self.create_member(
            organization=self.organization, user=member, role="member", teams=[member_team]
        )
        self.login_as(user=member)

        response = self.get_success_response(self.organization.slug)

        assert response.data["count"] == 1

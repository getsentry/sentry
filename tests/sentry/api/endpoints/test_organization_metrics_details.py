from datetime import timedelta
from unittest import mock
from unittest.mock import patch

import pytest

from sentry.sentry_metrics.use_case_id_registry import (
    UseCaseID,
    UseCaseIDAPIAccess,
    get_use_case_id_api_access,
)
from sentry.sentry_metrics.visibility import block_metric, block_tags_of_metric
from sentry.testutils.cases import MetricsAPIBaseTestCase, OrganizationMetricsIntegrationTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class OrganizationMetricsDetailsTest(OrganizationMetricsIntegrationTestCase):
    endpoint = "sentry-api-0-organization-metrics-details"

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_staff_metrics_details_sessions(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)
        response = self.get_success_response(
            self.organization.slug, project=self.project.id, useCase="sessions"
        )

        assert isinstance(response.data, list)

    def test_staff_and_superuser_metrics_details_sessions(self):
        staff_and_superuser = self.create_user(is_staff=True)
        self.login_as(user=staff_and_superuser, staff=True, superuser=True)
        # We should not fail when both modes are active
        response = self.get_success_response(
            self.organization.slug, project=self.project.id, useCase="sessions"
        )

        assert isinstance(response.data, list)

    def test_metrics_details_sessions(self):
        response = self.get_success_response(
            self.organization.slug, project=self.project.id, useCase="sessions"
        )

        assert isinstance(response.data, list)

    def test_metrics_details_transactions(self):
        response = self.get_success_response(
            self.organization.slug, project=self.project.id, useCase="transactions"
        )

        assert isinstance(response.data, list)

    def test_metrics_details_invalid_use_case(self):
        response = self.get_error_response(
            self.organization.slug, project=self.project.id, useCase="not-a-use-case"
        )

        assert response.status_code == 400

    def test_metrics_details_no_projects(self):
        response = self.get_success_response(self.organization.slug, useCase="transactions")

        assert isinstance(response.data, list)

    def test_staff_metrics_details_no_projects(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)
        response = self.get_success_response(self.organization.slug, useCase="transactions")

        assert isinstance(response.data, list)

    @patch("sentry.api.endpoints.organization_metrics.get_metrics_meta")
    def test_metrics_details_with_public_use_case(self, get_metrics_meta):
        get_metrics_meta.return_value = []

        self.login_as(user=self.user, superuser=True)
        self.get_success_response(
            self.organization.slug, project=[self.project.id], useCase=UseCaseID.SESSIONS.value
        )
        get_metrics_meta.assert_called_once_with(
            projects=[self.project], use_case_ids=[UseCaseID.SESSIONS], start=mock.ANY, end=mock.ANY
        )

        get_metrics_meta.reset_mock()

        normal_user = self.create_user()
        self.create_member(
            user=normal_user, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user=normal_user)
        self.get_success_response(
            self.organization.slug, project=[self.project.id], useCase=UseCaseID.SESSIONS.value
        )
        get_metrics_meta.assert_called_once_with(
            projects=[self.project], use_case_ids=[UseCaseID.SESSIONS], start=mock.ANY, end=mock.ANY
        )

    @patch("sentry.api.endpoints.organization_metrics.get_metrics_meta")
    def test_metrics_details_with_private_use_case(self, get_metrics_meta):
        get_metrics_meta.return_value = []

        self.login_as(user=self.user, superuser=True)
        self.get_success_response(
            self.organization.slug, project=[self.project.id], useCase=UseCaseID.METRIC_STATS.value
        )
        get_metrics_meta.assert_called_once_with(
            projects=[self.project],
            use_case_ids=[UseCaseID.METRIC_STATS],
            start=mock.ANY,
            end=mock.ANY,
        )

        get_metrics_meta.reset_mock()

        normal_user = self.create_user()
        self.create_member(
            user=normal_user, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user=normal_user)
        self.get_error_response(
            self.organization.slug,
            project=[self.project.id],
            useCase=UseCaseID.METRIC_STATS.value,
            status_code=400,
        )
        get_metrics_meta.assert_not_called()

    @patch("sentry.api.endpoints.organization_metrics.get_metrics_meta")
    def test_metrics_details_default_use_cases(self, get_metrics_meta):
        get_metrics_meta.return_value = []

        all_use_case_ids = [use_case_id for use_case_id in UseCaseID]
        public_use_case_ids = [
            use_case_id
            for use_case_id in all_use_case_ids
            if get_use_case_id_api_access(use_case_id) == UseCaseIDAPIAccess.PUBLIC
        ]

        # A superuser should have access to all use cases.
        self.login_as(user=self.user, superuser=True)
        self.get_success_response(self.organization.slug, project=[self.project.id])
        get_metrics_meta.assert_called_once_with(
            projects=[self.project], use_case_ids=all_use_case_ids, start=mock.ANY, end=mock.ANY
        )

        get_metrics_meta.reset_mock()

        # A staff user should have access to only public use cases.
        self.login_as(user=self.user, staff=True)
        self.get_success_response(self.organization.slug, project=[self.project.id])
        get_metrics_meta.assert_called_once_with(
            projects=[self.project], use_case_ids=public_use_case_ids, start=mock.ANY, end=mock.ANY
        )

        get_metrics_meta.reset_mock()

        # A normal user should have access to only public use cases.
        normal_user = self.create_user()
        self.create_member(
            user=normal_user, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user=normal_user)
        self.get_success_response(self.organization.slug, project=[self.project.id])
        get_metrics_meta.assert_called_once_with(
            projects=[self.project], use_case_ids=public_use_case_ids, start=mock.ANY, end=mock.ANY
        )

    def test_metrics_details_for_custom_metrics(self):
        project_1 = self.create_project()
        project_2 = self.create_project()

        block_metric("s:custom/user@none", [project_1])
        block_tags_of_metric("d:custom/page_load@millisecond", {"release"}, [project_2])

        metrics = (
            ("s:custom/user@none", "set", project_1),
            ("s:custom/user@none", "set", project_2),
            ("c:custom/clicks@none", "counter", project_1),
            ("d:custom/page_load@millisecond", "distribution", project_2),
        )
        for mri, entity, project in metrics:
            self.store_metric(
                project.organization.id,
                project.id,
                entity,  # type: ignore[arg-type]
                mri,
                {"transaction": "/hello"},
                int(self.now.timestamp()),
                10,
                UseCaseID.CUSTOM,
            )

        response = self.get_success_response(
            self.organization.slug, project=[project_1.id, project_2.id], useCase="custom"
        )
        assert len(response.data) == 3

        data = sorted(response.data, key=lambda d: d["mri"])
        assert data[0]["mri"] == "c:custom/clicks@none"
        assert data[0]["projectIds"] == [project_1.id]
        assert data[0]["blockingStatus"] == []
        assert data[1]["mri"] == "d:custom/page_load@millisecond"
        assert data[1]["projectIds"] == [project_2.id]
        assert data[1]["blockingStatus"] == [
            {"isBlocked": False, "blockedTags": ["release"], "projectId": project_2.id}
        ]
        assert data[2]["mri"] == "s:custom/user@none"
        assert sorted(data[2]["projectIds"]) == sorted([project_1.id, project_2.id])
        assert data[2]["blockingStatus"] == [
            {"isBlocked": True, "blockedTags": [], "projectId": project_1.id}
        ]

    def test_metrics_details_with_date_range(self):
        metrics = (
            ("c:custom/clicks_1@none", 0),
            ("c:custom/clicks_2@none", 1),
            ("c:custom/clicks_3@none", 7),
        )
        for mri, days in metrics:
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                "counter",
                mri,
                {"transaction": "/hello"},
                int((self.now - timedelta(days=days)).timestamp()),
                10,
                UseCaseID.CUSTOM,
            )

        for stats_period, expected_count in (("1d", 1), ("2d", 2), ("2w", 3)):
            response = self.get_success_response(
                self.organization.slug,
                project=self.project.id,
                useCase="custom",
                statsPeriod=stats_period,
            )
            assert len(response.data) == expected_count

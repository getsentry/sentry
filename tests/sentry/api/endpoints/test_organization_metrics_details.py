from __future__ import annotations

from unittest.mock import patch

import pytest

from sentry.models.project import Project
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

    @patch("sentry.api.endpoints.organization_metrics_details.get_metrics_meta")
    def test_metrics_details_with_public_use_case(self, get_metrics_meta):
        get_metrics_meta.return_value = []

        self.login_as(user=self.user, superuser=True)
        self.get_success_response(
            self.organization.slug, project=[self.project.id], useCase=UseCaseID.SESSIONS.value
        )
        get_metrics_meta.assert_called_once_with(
            organization=self.organization,
            projects=[self.project],
            use_case_ids=[UseCaseID.SESSIONS],
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
            organization=self.organization,
            projects=[self.project],
            use_case_ids=[UseCaseID.SESSIONS],
        )

    @patch("sentry.api.endpoints.organization_metrics_details.get_metrics_meta")
    def test_metrics_details_with_private_use_case(self, get_metrics_meta):
        get_metrics_meta.return_value = []

        self.login_as(user=self.user, superuser=True)
        self.get_success_response(
            self.organization.slug, project=[self.project.id], useCase=UseCaseID.METRIC_STATS.value
        )
        get_metrics_meta.assert_called_once_with(
            organization=self.organization,
            projects=[self.project],
            use_case_ids=[UseCaseID.METRIC_STATS],
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

    @patch("sentry.api.endpoints.organization_metrics_details.get_metrics_meta")
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
            organization=self.organization, projects=[self.project], use_case_ids=all_use_case_ids
        )

        get_metrics_meta.reset_mock()

        # A staff user should have access to only public use cases.
        self.login_as(user=self.user, staff=True)
        self.get_success_response(self.organization.slug, project=[self.project.id])
        get_metrics_meta.assert_called_once_with(
            organization=self.organization,
            projects=[self.project],
            use_case_ids=public_use_case_ids,
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
            organization=self.organization,
            projects=[self.project],
            use_case_ids=public_use_case_ids,
        )

    def test_metrics_details_for_custom_metrics(self):
        project_1 = self.create_project()
        project_2 = self.create_project()

        block_metric("s:custom/user@none", [project_1])
        block_tags_of_metric("d:custom/page_load@millisecond", {"release"}, [project_2])

        metrics: tuple[tuple[str, Project], ...] = (
            ("s:custom/user@none", project_1),
            ("s:custom/user@none", project_2),
            ("c:custom/clicks@none", project_1),
            ("d:custom/page_load@millisecond", project_2),
            ("g:custom/page_load@millisecond", project_2),
        )
        for mri, project in metrics:
            self.store_metric(
                project.organization.id,
                project.id,
                mri,
                {"transaction": "/hello"},
                int(self.now.timestamp()),
                10,
            )

        response = self.get_success_response(
            self.organization.slug, project=[project_1.id, project_2.id], useCase="custom"
        )
        assert len(response.data) == 4

        data = sorted(response.data, key=lambda d: d["mri"])
        assert data[0]["mri"] == "c:custom/clicks@none"
        assert data[0]["projectIds"] == [project_1.id]
        assert data[0]["blockingStatus"] == []
        assert data[1]["mri"] == "d:custom/page_load@millisecond"
        assert data[1]["projectIds"] == [project_2.id]
        assert data[1]["blockingStatus"] == [
            {"isBlocked": False, "blockedTags": ["release"], "projectId": project_2.id}
        ]
        assert data[3]["mri"] == "s:custom/user@none"
        assert sorted(data[3]["projectIds"]) == sorted([project_1.id, project_2.id])
        assert data[3]["blockingStatus"] == [
            {"isBlocked": True, "blockedTags": [], "projectId": project_1.id}
        ]
        assert sorted(data[1]["operations"]) == [
            "avg",
            "count",
            "max",
            "min",
            "p50",
            "p75",
            "p90",
            "p95",
            "p99",
            "sum",
        ]

        assert sorted(data[2]["operations"]) == [
            "avg",
            "count",
            "max",
            "min",
            "sum",
        ]

        # test default activated percentiles
        response = self.get_success_response(
            self.organization.slug, project=[project_1.id, project_2.id], useCase="custom"
        )
        data = sorted(response.data, key=lambda d: d["mri"])
        assert sorted(data[1]["operations"]) == [
            "avg",
            "count",
            "max",
            "min",
            "p50",
            "p75",
            "p90",
            "p95",
            "p99",
            "sum",
        ]

        # test deactivated percentiles
        self.organization.update_option("sentry:metrics_activate_percentiles", False)
        response = self.get_success_response(
            self.organization.slug, project=[project_1.id, project_2.id], useCase="custom"
        )
        data = sorted(response.data, key=lambda d: d["mri"])
        assert sorted(data[1]["operations"]) == [
            "avg",
            "count",
            "max",
            "min",
            "sum",
        ]

        # test default deactivated gauges
        response = self.get_success_response(
            self.organization.slug, project=[project_1.id, project_2.id], useCase="custom"
        )
        data = sorted(response.data, key=lambda d: d["mri"])
        assert sorted(data[2]["operations"]) == [
            "avg",
            "count",
            "max",
            "min",
            "sum",
        ]

        # test activated gauges
        self.organization.update_option("sentry:metrics_activate_last_for_gauges", True)
        response = self.get_success_response(
            self.organization.slug, project=[project_1.id, project_2.id], useCase="custom"
        )
        data = sorted(response.data, key=lambda d: d["mri"])

        assert sorted(data[2]["operations"]) == [
            "avg",
            "count",
            "last",
            "max",
            "min",
            "sum",
        ]

    def test_metrics_details_when_organization_has_no_projects(self):
        organization_without_projects = self.create_organization()
        self.create_member(user=self.user, organization=organization_without_projects)
        response = self.get_response(organization_without_projects.slug)
        assert response.status_code == 404
        assert response.data["detail"] == "You must supply at least one project to see its metrics"

    def test_blocking_metrics_dont_duplicate_with_multiple_use_cases(self):
        project_1 = self.create_project()

        block_metric("s:custom/user@none", [project_1])

        metrics: tuple[tuple[str, Project], ...] = (
            ("s:custom/user@none", project_1),
            ("c:custom/clicks@none", project_1),
        )
        for mri, project in metrics:
            self.store_metric(
                project.organization.id,
                project.id,
                mri,
                {"transaction": "/hello"},
                int(self.now.timestamp()),
                10,
            )

        response = self.get_success_response(
            self.organization.slug, project=[project_1.id], useCase=["transactions", "custom"]
        )
        assert len(response.data) == 2

        data = sorted(response.data, key=lambda d: d["mri"])
        assert data[0]["mri"] == "c:custom/clicks@none"
        assert data[0]["projectIds"] == [project_1.id]
        assert data[0]["blockingStatus"] == []
        assert data[1]["mri"] == "s:custom/user@none"
        assert sorted(data[1]["projectIds"]) == sorted([project_1.id])
        assert data[1]["blockingStatus"] == [
            {"isBlocked": True, "blockedTags": [], "projectId": project_1.id}
        ]

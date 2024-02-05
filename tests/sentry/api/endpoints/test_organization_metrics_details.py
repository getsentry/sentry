import pytest

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.visibility import block_metric, block_tags_of_metric
from sentry.testutils.cases import MetricsAPIBaseTestCase, OrganizationMetricsIntegrationTestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


@region_silo_test
class OrganizationMetricsDetailsTest(OrganizationMetricsIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-details"

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_metrics_meta_sessions(self):
        response = self.get_success_response(
            self.organization.slug, project=[self.project.id], useCase=["sessions"]
        )

        assert isinstance(response.data, list)

    def test_metrics_meta_transactions(self):
        response = self.get_success_response(
            self.organization.slug, project=[self.project.id], useCase=["transactions"]
        )

        assert isinstance(response.data, list)

    def test_metrics_meta_invalid_use_case(self):
        response = self.get_error_response(
            self.organization.slug, project=[self.project.id], useCase=["not-a-use-case"]
        )

        assert response.status_code == 400

    def test_metrics_meta_no_projects(self):
        response = self.get_success_response(
            self.organization.slug, project=[], useCase=["transactions"]
        )

        assert isinstance(response.data, list)

    def test_metrics_meta_for_custom_metrics(self):
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
                entity,  # type:ignore
                mri,
                {"transaction": "/hello"},
                int(self.now.timestamp()),
                10,
                UseCaseID.CUSTOM,
            )

        response = self.get_success_response(
            self.organization.slug, project=[project_1.id, project_2.id], useCase=["custom"]
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

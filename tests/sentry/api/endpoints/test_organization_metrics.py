import copy
from functools import partial

import pytest
from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.visibility import BlockedMetric, block_metric, get_blocked_metrics
from sentry.silo import SiloMode
from sentry.snuba.metrics import (
    DERIVED_METRICS,
    SessionMRI,
    SingularEntityDerivedMetric,
    complement,
    division_float,
)
from sentry.testutils.cases import (
    APITestCase,
    MetricsAPIBaseTestCase,
    OrganizationMetricsIntegrationTestCase,
)
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]

MOCKED_DERIVED_METRICS = copy.deepcopy(DERIVED_METRICS)
MOCKED_DERIVED_METRICS.update(
    {
        "crash_free_fake": SingularEntityDerivedMetric(
            metric_mri="crash_free_fake",
            metrics=[
                SessionMRI.CRASHED.value,
                SessionMRI.ERRORED_SET.value,
            ],
            unit="percentage",
            snql=lambda crashed_count, errored_set, entity, metric_ids, alias=None: complement(
                division_float(crashed_count, errored_set, alias=alias), alias="crash_free_fake"
            ),
        )
    }
)


def mocked_mri_resolver(metric_names, mri_func):
    return lambda x: x if x in metric_names else mri_func(x)


def indexer_record(use_case_id: UseCaseID, org_id: int, string: str) -> int:
    ret = indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)
    assert ret is not None
    return ret


perf_indexer_record = partial(indexer_record, UseCaseID.TRANSACTIONS)
rh_indexer_record = partial(indexer_record, UseCaseID.SESSIONS)


@region_silo_test
class OrganizationMetricsPermissionTest(APITestCase):

    endpoints = (
        ("sentry-api-0-organization-metrics-index",),
        ("sentry-api-0-organization-metrics-details",),
        ("sentry-api-0-organization-metric-details", "foo"),
        ("sentry-api-0-organization-metrics-tags",),
        ("sentry-api-0-organization-metrics-tag-details", "foo"),
        ("sentry-api-0-organization-metrics-data",),
    )

    def send_get_request(self, token, endpoint, *args):
        url = reverse(endpoint, args=(self.project.organization.slug,) + args)
        return self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code in (200, 400, 404)


@region_silo_test
class OrganizationMetricsTest(OrganizationMetricsIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-index"

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

        block_metric(BlockedMetric("s:custom/user@none", set()), [project_1])

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
        assert data[0]["project_ids"] == [project_1.id]
        assert data[0]["blockedForProjects"] == []
        assert data[1]["mri"] == "d:custom/page_load@millisecond"
        assert data[1]["project_ids"] == [project_2.id]
        assert data[1]["blockedForProjects"] == []
        assert data[2]["mri"] == "s:custom/user@none"
        assert sorted(data[2]["project_ids"]) == sorted([project_1.id, project_2.id])
        assert data[2]["blockedForProjects"] == [{"blockedTags": [], "projectId": project_1.id}]

    def test_block_metric(self):
        metrics = ["s:custom/user@none", "c:custom/clicks@none"]

        response = self.get_success_response(
            self.organization.slug, method="POST", project=[self.project.id], metrics=metrics
        )
        assert response.status_code == 200
        assert len(get_blocked_metrics([self.project])[self.project.id].metrics) == 2

import copy
from functools import partial

import pytest
from django.urls import reverse

from sentry.models import ApiToken
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.silo import SiloMode
from sentry.snuba.metrics.fields import DERIVED_METRICS, SingularEntityDerivedMetric
from sentry.snuba.metrics.fields.snql import complement, division_float
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.testutils.cases import APITestCase, OrganizationMetricMetaIntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test

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
            snql=lambda *args, entity, metric_ids, alias=None: complement(
                division_float(*args, entity, metric_ids), alias="crash_free_fake"
            ),
        )
    }
)

pytestmark = pytest.mark.sentry_metrics


def mocked_mri_resolver(metric_names, mri_func):
    return lambda x: x if x in metric_names else mri_func(x)


def indexer_record(use_case_id: UseCaseID, org_id: int, string: str) -> int:
    return indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)


perf_indexer_record = partial(indexer_record, UseCaseID.TRANSACTIONS)
rh_indexer_record = partial(indexer_record, UseCaseID.SESSIONS)


@region_silo_test(stable=True)
class OrganizationMetricsPermissionTest(APITestCase):

    endpoints = (
        ("sentry-api-0-organization-metrics-index",),
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


@region_silo_test(stable=True)
class OrganizationMetricsMetaTest(OrganizationMetricMetaIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-index"

    def setUp(self):
        super().setUp()
        self.proj2 = self.create_project(organization=self.organization)
        self.transaction_proj = self.create_project(organization=self.organization)
        self.session_metrics_meta = [
            {
                "name": "sentry.sessions.session",
                "type": "counter",
                "operations": ["max_timestamp", "min_timestamp", "sum"],
                "unit": None,
            },
            {
                "name": "sentry.sessions.user",
                "type": "set",
                "operations": ["count_unique", "max_timestamp", "min_timestamp"],
                "unit": None,
            },
            {"name": "session.abnormal", "operations": [], "type": "numeric", "unit": "sessions"},
            {"name": "session.abnormal_user", "operations": [], "type": "numeric", "unit": "users"},
            {"name": "session.all", "type": "numeric", "operations": [], "unit": "sessions"},
            {"name": "session.all_user", "type": "numeric", "operations": [], "unit": "users"},
            {"name": "session.anr_rate", "operations": [], "type": "numeric", "unit": "percentage"},
            {"name": "session.crash_free", "operations": [], "type": "numeric", "unit": "sessions"},
            {
                "name": "session.crash_free_rate",
                "type": "numeric",
                "operations": [],
                "unit": "percentage",
            },
            {
                "name": "session.crash_free_user",
                "operations": [],
                "type": "numeric",
                "unit": "users",
            },
            {
                "name": "session.crash_free_user_rate",
                "type": "numeric",
                "operations": [],
                "unit": "percentage",
            },
            {
                "name": "session.crash_rate",
                "type": "numeric",
                "operations": [],
                "unit": "percentage",
            },
            {
                "name": "session.crash_user_rate",
                "type": "numeric",
                "operations": [],
                "unit": "percentage",
            },
            {"name": "session.crashed", "type": "numeric", "operations": [], "unit": "sessions"},
            {"name": "session.crashed_user", "type": "numeric", "operations": [], "unit": "users"},
            {
                "name": "session.errored_preaggregated",
                "operations": [],
                "type": "numeric",
                "unit": "sessions",
            },
            {
                "name": "session.errored_user",
                "type": "numeric",
                "operations": [],
                "unit": "users",
            },
            {
                "name": "session.foreground_anr_rate",
                "operations": [],
                "type": "numeric",
                "unit": "percentage",
            },
            {
                "name": "session.healthy_user",
                "type": "numeric",
                "operations": [],
                "unit": "users",
            },
        ]

    # TODO do we really need this test ?
    def test_metrics_index(self):
        """

        Note that this test will fail once we have a metrics meta store,
        because the setUp bypasses it.
        """
        response = self.get_success_response(
            self.organization.slug, project=[self.project.id], useCase=["sessions"]
        )

        assert type(response.data) == list
        assert len(response.data) > 0

        for metric in response.data:
            assert "name" in metric
            assert "mri" in metric
            assert type(metric["operations"]) == list

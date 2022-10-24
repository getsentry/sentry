import copy
import time
from functools import partial
from operator import itemgetter
from unittest.mock import patch

import pytest
from django.urls import reverse

from sentry.models import ApiToken
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics import TransactionStatusTagValue, TransactionTagsKey
from sentry.snuba.metrics.fields import (
    DERIVED_METRICS,
    SingularEntityDerivedMetric,
    TransactionSatisfactionTagValue,
)
from sentry.snuba.metrics.fields.snql import complement, division_float
from sentry.snuba.metrics.naming_layer.mapping import get_public_name_from_mri
from sentry.snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI
from sentry.testutils import APITestCase
from sentry.testutils.cases import OrganizationMetricMetaIntegrationTestCase
from sentry.testutils.silo import region_silo_test

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


def indexer_record(use_case_id: UseCaseKey, org_id: int, string: str) -> int:
    return indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)


perf_indexer_record = partial(indexer_record, UseCaseKey.PERFORMANCE)
rh_indexer_record = partial(indexer_record, UseCaseKey.RELEASE_HEALTH)


@region_silo_test
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

        token = ApiToken.objects.create(user=self.user, scope_list=[])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 403

        token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code in (200, 400, 404)

    def test_feature_flag(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 404


@region_silo_test
class OrganizationMetricsIndexIntegrationTest(OrganizationMetricMetaIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-index"

    def setUp(self):
        super().setUp()
        self.proj2 = self.create_project(organization=self.organization)
        self.transaction_proj = self.create_project(organization=self.organization)
        self.session_metrics_meta = [
            {
                "name": "sentry.sessions.session",
                "type": "counter",
                "operations": ["sum"],
                "unit": None,
            },
            {
                "name": "sentry.sessions.user",
                "type": "set",
                "operations": ["count_unique"],
                "unit": None,
            },
            {"name": "session.abnormal", "operations": [], "type": "numeric", "unit": "sessions"},
            {"name": "session.abnormal_user", "operations": [], "type": "numeric", "unit": "users"},
            {"name": "session.all", "type": "numeric", "operations": [], "unit": "sessions"},
            {"name": "session.all_user", "type": "numeric", "operations": [], "unit": "users"},
            {
                "name": "session.crash_free_rate",
                "type": "numeric",
                "operations": [],
                "unit": "percentage",
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
                "name": "session.errored_user",
                "type": "numeric",
                "operations": [],
                "unit": "users",
            },
            {
                "name": "session.healthy_user",
                "type": "numeric",
                "operations": [],
                "unit": "users",
            },
        ]

    @patch(
        "sentry.snuba.metrics.datasource.get_public_name_from_mri",
        mocked_mri_resolver(["metric1", "metric2", "metric3"], get_public_name_from_mri),
    )
    def test_metrics_index(self):
        """

        Note that this test will fail once we have a metrics meta store,
        because the setUp bypasses it.
        """
        response = self.get_success_response(self.organization.slug, project=[self.project.id])

        assert response.data == [
            {"name": "metric1", "type": "counter", "operations": ["sum"], "unit": None},
            {"name": "metric2", "type": "set", "operations": ["count_unique"], "unit": None},
            {"name": "metric3", "type": "set", "operations": ["count_unique"], "unit": None},
        ]

        self.store_session(
            self.build_session(
                project_id=self.proj2.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@1.0",
            )
        )

        response = self.get_success_response(self.organization.slug, project=[self.proj2.id])
        assert response.data == self.session_metrics_meta

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    def test_metrics_index_derived_metrics_and_invalid_derived_metric(self):
        for errors, minute in [(0, 0), (2, 1)]:
            self.store_session(
                self.build_session(
                    project_id=self.proj2.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                    release="foobar@2.0",
                    errors=errors,
                )
            )

        response = self.get_success_response(self.organization.slug, project=[self.proj2.id])
        assert response.data == sorted(
            self.session_metrics_meta
            + [
                {
                    "name": "sentry.sessions.session.error",
                    "type": "set",
                    "operations": ["count_unique"],
                    "unit": None,
                },
                {
                    "name": "session.errored",
                    "type": "numeric",
                    "operations": [],
                    "unit": "sessions",
                },
                {
                    "name": "session.healthy",
                    "type": "numeric",
                    "operations": [],
                    "unit": "sessions",
                },
            ],
            key=itemgetter("name"),
        )

    def test_metrics_index_transaction_derived_metrics(self):
        user_ts = time.time()
        org_id = self.organization.id
        tx_metric = perf_indexer_record(org_id, TransactionMRI.DURATION.value)
        tx_status = perf_indexer_record(org_id, TransactionTagsKey.TRANSACTION_STATUS.value)
        tx_satisfaction = perf_indexer_record(
            self.organization.id, TransactionTagsKey.TRANSACTION_SATISFACTION.value
        )
        tx_user_metric = perf_indexer_record(self.organization.id, TransactionMRI.USER.value)

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.transaction_proj.id,
                    "metric_id": tx_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        tx_satisfaction: perf_indexer_record(
                            self.organization.id, TransactionSatisfactionTagValue.FRUSTRATED.value
                        ),
                    },
                    "type": "s",
                    "value": [1, 2],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.transaction_proj.id,
                    "metric_id": tx_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        tx_satisfaction: perf_indexer_record(
                            self.organization.id, TransactionSatisfactionTagValue.SATISFIED.value
                        ),
                        tx_status: perf_indexer_record(
                            self.organization.id, TransactionStatusTagValue.CANCELLED.value
                        ),
                    },
                    "type": "s",
                    "value": [1, 3],  # user 1 had mixed transactions, user 3 only satisfied
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.transaction_proj.id,
                    "metric_id": tx_metric,
                    "timestamp": user_ts,
                    "tags": {
                        tx_satisfaction: perf_indexer_record(
                            self.organization.id, TransactionSatisfactionTagValue.TOLERATED.value
                        ),
                        tx_status: perf_indexer_record(
                            self.organization.id, TransactionStatusTagValue.OK.value
                        ),
                    },
                    "type": "d",
                    "value": [0.3],
                    "retention_days": 90,
                },
            ],
            entity="metrics_distributions",
        )
        response = self.get_success_response(
            self.organization.slug, project=[self.transaction_proj.id]
        )
        assert response.data == sorted(
            [
                {
                    "name": "transaction.apdex",
                    "type": "numeric",
                    "operations": [],
                    "unit": "percentage",
                },
                {
                    "name": "transaction.duration",
                    "type": "distribution",
                    "operations": [
                        "avg",
                        "count",
                        "histogram",
                        "max",
                        "min",
                        "p50",
                        "p75",
                        "p90",
                        "p95",
                        "p99",
                        "sum",
                    ],
                    "unit": None,
                },
                {
                    "name": "transaction.failure_rate",
                    "type": "numeric",
                    "operations": [],
                    "unit": "transactions",
                },
                {
                    "name": "transaction.miserable_user",
                    "type": "numeric",
                    "operations": [],
                    "unit": "users",
                },
                {
                    "name": "transaction.user",
                    "type": "set",
                    "operations": ["count_unique"],
                    "unit": None,
                },
                {
                    "name": "transaction.user_misery",
                    "operations": [],
                    "type": "numeric",
                    "unit": "percentage",
                },
            ],
            key=itemgetter("name"),
        )

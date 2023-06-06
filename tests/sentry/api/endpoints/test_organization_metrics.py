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
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
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
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test

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

        with exempt_from_silo_limits():
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 403

        with exempt_from_silo_limits():
            token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code in (200, 400, 404)


@region_silo_test(stable=True)
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
            {
                "name": "metric1",
                "type": "counter",
                "operations": ["max_timestamp", "min_timestamp", "sum"],
                "unit": None,
            },
            {
                "name": "metric2",
                "type": "set",
                "operations": ["count_unique", "max_timestamp", "min_timestamp"],
                "unit": None,
            },
            {
                "name": "metric3",
                "type": "set",
                "operations": ["count_unique", "max_timestamp", "min_timestamp"],
                "unit": None,
            },
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
        # RaduW This is ridiculous we are asserting on a canned response of metric values
        # It will break every time we add a new public metric or every time we change in any
        # way the order in which the metrics are returned !
        assert response.data == self.session_metrics_meta

    # TODO what exactly are we testing here ?
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
                    "operations": ["count_unique", "max_timestamp", "min_timestamp"],
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
                {
                    "name": "sessions.errored.unique",
                    "operations": [],
                    "type": "numeric",
                    "unit": "sessions",
                },
            ],
            key=itemgetter("name"),
        )

    def test_metrics_index_transaction_derived_metrics(self):
        user_ts = int(time.time())

        for value in 1, 2:
            self.store_metric(
                org_id=self.organization.id,
                project_id=self.transaction_proj.id,
                name=TransactionMRI.USER.value,
                timestamp=user_ts,
                tags={
                    TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.FRUSTRATED.value,
                },
                type="set",
                value=value,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
            )

        for value in 1, 3:
            self.store_metric(
                org_id=self.organization.id,
                project_id=self.transaction_proj.id,
                name=TransactionMRI.USER.value,
                timestamp=user_ts,
                tags={
                    TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.SATISFIED.value,
                    TransactionTagsKey.TRANSACTION_STATUS.value: TransactionStatusTagValue.CANCELLED.value,
                },
                type="set",
                value=value,  # user 1 had mixed transactions, user 3 only satisfied
                use_case_id=UseCaseKey.RELEASE_HEALTH,
            )

        self.store_metric(
            org_id=self.organization.id,
            project_id=self.transaction_proj.id,
            name=TransactionMRI.DURATION.value,
            timestamp=user_ts,
            tags={
                TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.TOLERATED.value,
                TransactionTagsKey.TRANSACTION_STATUS.value: TransactionStatusTagValue.OK.value,
            },
            type="distribution",
            value=0.3,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
        )

        self.store_metric(
            org_id=self.organization.id,
            project_id=self.transaction_proj.id,
            # TODO: check that this is correct, because APDEX is the only derived metric that has either DURATION or LCP
            #  in the required metrics.
            name=TransactionMRI.MEASUREMENTS_LCP.value,
            timestamp=user_ts,
            tags={
                TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.SATISFIED.value,
                TransactionTagsKey.TRANSACTION_STATUS.value: TransactionStatusTagValue.OK.value,
            },
            type="distribution",
            value=0.3,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
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
                        "max_timestamp",
                        "min",
                        "min_timestamp",
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
                    "name": "transaction.failure_count",
                    "operations": [],
                    "type": "numeric",
                    "unit": "transactions",
                },
                {
                    "name": "transaction.failure_rate",
                    "type": "numeric",
                    "operations": [],
                    "unit": "transactions",
                },
                {
                    "name": "transaction.measurements.lcp",
                    "operations": [
                        "avg",
                        "count",
                        "histogram",
                        "max",
                        "max_timestamp",
                        "min",
                        "min_timestamp",
                        "p50",
                        "p75",
                        "p90",
                        "p95",
                        "p99",
                        "sum",
                    ],
                    "type": "distribution",
                    "unit": None,
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
                    "operations": ["count_unique", "max_timestamp", "min_timestamp"],
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

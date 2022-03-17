import copy
import time
from operator import itemgetter
from unittest.mock import patch

from django.urls import reverse

from sentry.models import ApiToken
from sentry.snuba.metrics.fields import DERIVED_METRICS, SingularEntityDerivedMetric
from sentry.snuba.metrics.fields.snql import percentage
from sentry.testutils import APITestCase
from sentry.testutils.cases import OrganizationMetricMetaIntegrationTestCase

MOCKED_DERIVED_METRICS = copy.deepcopy(DERIVED_METRICS)
MOCKED_DERIVED_METRICS.update(
    {
        "crash_free_fake": SingularEntityDerivedMetric(
            metric_name="crash_free_fake",
            metrics=["session.crashed", "session.errored_set"],
            unit="percentage",
            snql=lambda *args, entity, metric_ids, alias=None: percentage(
                *args, entity, metric_ids, alias="crash_free_fake"
            ),
        )
    }
)


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


class OrganizationMetricsIndexIntegrationTest(OrganizationMetricMetaIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metrics-index"

    def setUp(self):
        super().setUp()
        self.proj2 = self.create_project(organization=self.organization)
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
            {
                "name": "session.crash_free_rate",
                "type": "numeric",
                "operations": [],
                "unit": "percentage",
            },
            {"name": "session.crashed", "type": "numeric", "operations": [], "unit": "sessions"},
            {
                "name": "session.errored_preaggregated",
                "type": "numeric",
                "operations": [],
                "unit": "sessions",
            },
            {"name": "session.init", "type": "numeric", "operations": [], "unit": "sessions"},
        ]

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
    def test_metrics_index_invalid_derived_metric(self):
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
                    "name": "session.errored_set",
                    "type": "numeric",
                    "operations": [],
                    "unit": "sessions",
                },
            ],
            key=itemgetter("name"),
        )

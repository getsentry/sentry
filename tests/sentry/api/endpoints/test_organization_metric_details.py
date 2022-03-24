import copy
import time
from unittest.mock import patch

from sentry.sentry_metrics import indexer
from sentry.snuba.metrics import SingularEntityDerivedMetric, percentage, resolve_weak
from sentry.testutils.cases import OrganizationMetricMetaIntegrationTestCase
from tests.sentry.api.endpoints.test_organization_metrics import MOCKED_DERIVED_METRICS

MOCKED_DERIVED_METRICS_2 = copy.deepcopy(MOCKED_DERIVED_METRICS)
MOCKED_DERIVED_METRICS_2.update(
    {
        "derived_metric.multiple_metrics": SingularEntityDerivedMetric(
            metric_name="derived_metric.multiple_metrics",
            metrics=["metric_foo_doe", "session.all"],
            unit="percentage",
            snql=lambda *args, metric_ids, alias=None: percentage(
                *args, alias="session.crash_free_rate"
            ),
        )
    }
)


class OrganizationMetricDetailsIntegrationTest(OrganizationMetricMetaIntegrationTestCase):

    endpoint = "sentry-api-0-organization-metric-details"

    def test_metric_details(self):
        # metric1:
        response = self.get_success_response(
            self.organization.slug,
            "metric1",
        )
        assert response.data == {
            "name": "metric1",
            "type": "counter",
            "operations": ["sum"],
            "unit": None,
            "tags": [
                {"key": "tag1"},
                {"key": "tag2"},
                {"key": "tag3"},
            ],
        }

        # metric2:
        response = self.get_success_response(
            self.organization.slug,
            "metric2",
        )
        assert response.data == {
            "name": "metric2",
            "type": "set",
            "operations": ["count_unique"],
            "unit": None,
            "tags": [
                {"key": "tag1"},
                {"key": "tag2"},
                {"key": "tag4"},
            ],
        }

        # metric3:
        response = self.get_success_response(
            self.organization.slug,
            "metric3",
        )
        assert response.data == {
            "name": "metric3",
            "type": "set",
            "operations": ["count_unique"],
            "unit": None,
            "tags": [],
        }

    def test_metric_details_metric_does_not_exist_in_indexer(self):
        response = self.get_response(
            self.organization.slug,
            "foo.bar",
        )
        assert response.status_code == 404
        assert (
            response.data["detail"]
            == "Some or all of the metric names in ['foo.bar'] do not exist in the indexer"
        )

    def test_metric_details_metric_does_not_have_data(self):
        indexer.record(self.organization.id, "foo.bar")
        response = self.get_response(
            self.organization.slug,
            "foo.bar",
        )
        assert response.status_code == 404

        indexer.record(self.organization.id, "sentry.sessions.session")
        response = self.get_response(
            self.organization.slug,
            "session.crash_free_rate",
        )
        assert response.status_code == 404
        assert (
            response.data["detail"]
            == "The following metrics ['session.crash_free_rate'] do not exist in the dataset"
        )

    def test_derived_metric_details(self):
        # 3rd Test: Test for derived metrics when indexer and dataset have data
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
            )
        )
        response = self.get_success_response(
            self.organization.slug,
            "session.crash_free_rate",
        )
        assert response.data == {
            "name": "session.crash_free_rate",
            "type": "numeric",
            "operations": [],
            "unit": "percentage",
            "tags": [{"key": "environment"}, {"key": "release"}, {"key": "session.status"}],
        }

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS_2)
    @patch("sentry.snuba.metrics.datasource.DERIVED_METRICS", MOCKED_DERIVED_METRICS_2)
    def test_incorrectly_setup_derived_metric(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
                errors=2,
            )
        )
        response = self.get_response(
            self.organization.slug,
            "crash_free_fake",
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "The following metrics {'crash_free_fake'} cannot be computed from single entities. "
            "Please revise the definition of these singular entity derived metrics"
        )

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS_2)
    @patch("sentry.snuba.metrics.datasource.DERIVED_METRICS", MOCKED_DERIVED_METRICS_2)
    def test_same_entity_multiple_metric_ids(self):
        """
        Test that ensures that if a derived metric is defined with constituent metrics that
        belong to the same entity but have different ids, then we are able to correctly return
        its detail info
        """
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
                errors=2,
            )
        )
        response = self.get_response(
            self.organization.slug,
            "derived_metric.multiple_metrics",
        )
        assert response.status_code == 404
        assert response.json()["detail"] == (
            "Not all the requested metrics or the constituent metrics in "
            "['derived_metric.multiple_metrics'] have data in the dataset"
        )
        org_id = self.organization.id
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record(org_id, "metric_foo_doe"),
                    "timestamp": int(time.time()),
                    "tags": {
                        resolve_weak("release"): indexer.record(org_id, "foo"),
                    },
                    "type": "c",
                    "value": 1,
                    "retention_days": 90,
                },
            ],
            entity="metrics_counters",
        )
        response = self.get_success_response(
            self.organization.slug,
            "derived_metric.multiple_metrics",
        )
        assert response.data == {
            "name": "derived_metric.multiple_metrics",
            "type": "numeric",
            "operations": [],
            "unit": "percentage",
            "tags": [{"key": "release"}],
        }

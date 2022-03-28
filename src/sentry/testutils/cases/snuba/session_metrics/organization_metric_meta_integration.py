import time

from sentry.sentry_metrics import indexer

from .metrics_api import MetricsAPIBaseTestCase


class OrganizationMetricMetaIntegrationTestCase(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        now = int(time.time())

        # TODO: move _send to SnubaMetricsTestCase
        org_id = self.organization.id
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record(org_id, "metric1"),
                    "timestamp": now,
                    "tags": {
                        indexer.record(org_id, "tag1"): indexer.record(org_id, "value1"),
                        indexer.record(org_id, "tag2"): indexer.record(org_id, "value2"),
                    },
                    "type": "c",
                    "value": 1,
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record(org_id, "metric1"),
                    "timestamp": now,
                    "tags": {
                        indexer.record(org_id, "tag3"): indexer.record(org_id, "value3"),
                    },
                    "type": "c",
                    "value": 1,
                    "retention_days": 90,
                },
            ],
            entity="metrics_counters",
        )
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record(org_id, "metric2"),
                    "timestamp": now,
                    "tags": {
                        indexer.record(org_id, "tag4"): indexer.record(org_id, "value3"),
                        indexer.record(org_id, "tag1"): indexer.record(org_id, "value2"),
                        indexer.record(org_id, "tag2"): indexer.record(org_id, "value1"),
                    },
                    "type": "s",
                    "value": [123],
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record(org_id, "metric3"),
                    "timestamp": now,
                    "tags": {},
                    "type": "s",
                    "value": [123],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )

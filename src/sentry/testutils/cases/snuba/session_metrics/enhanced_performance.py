from __future__ import annotations

from datetime import datetime
from typing import Mapping

from django.utils import timezone
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE

from sentry.search.events.constants import (
    METRIC_FALSE_TAG_VALUE,
    METRIC_MISERABLE_TAG_KEY,
    METRIC_SATISFIED_TAG_KEY,
    METRIC_TOLERATED_TAG_KEY,
    METRIC_TRUE_TAG_VALUE,
    METRICS_MAP,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer

from ...base import TestCase
from .base import SessionMetricsTestCase


class MetricsEnhancedPerformanceTestCase(SessionMetricsTestCase, TestCase):
    TYPE_MAP = {
        "metrics_distributions": "d",
        "metrics_sets": "s",
        "metrics_counters": "c",
    }
    ENTITY_MAP = {
        "transaction.duration": "metrics_distributions",
        "measurements.lcp": "metrics_distributions",
        "measurements.fp": "metrics_distributions",
        "measurements.fcp": "metrics_distributions",
        "measurements.fid": "metrics_distributions",
        "measurements.cls": "metrics_distributions",
        "user": "metrics_sets",
    }
    METRIC_STRINGS = []
    DEFAULT_METRIC_TIMESTAMP = datetime(2015, 1, 1, 10, 15, 0, tzinfo=timezone.utc)

    def setUp(self):
        super().setUp()
        self._index_metric_strings()

    def _index_metric_strings(self):
        strings = [
            "transaction",
            "environment",
            "http.status",
            "transaction.status",
            METRIC_SATISFIED_TAG_KEY,
            METRIC_TOLERATED_TAG_KEY,
            METRIC_MISERABLE_TAG_KEY,
            METRIC_TRUE_TAG_VALUE,
            METRIC_FALSE_TAG_VALUE,
            *self.METRIC_STRINGS,
            *list(SPAN_STATUS_NAME_TO_CODE.keys()),
            *list(METRICS_MAP.values()),
        ]
        org_strings = {self.organization.id: set(strings)}
        PGStringIndexer().bulk_record(org_strings=org_strings)

    def store_metric(
        self,
        value: list[int] | int,
        metric: str = "transaction.duration",
        tags: Mapping[str, str] | None = None,
        timestamp: datetime | None = None,
        project: int | None = None,
    ) -> None:
        internal_metric = METRICS_MAP[metric]
        entity = self.ENTITY_MAP[metric]
        if tags is None:
            tags = {}
        else:
            tags = {
                indexer.resolve(self.organization.id, key): indexer.resolve(
                    self.organization.id, value
                )
                for key, value in tags.items()
            }

        if timestamp is None:
            metric_timestamp = self.DEFAULT_METRIC_TIMESTAMP.timestamp()
        else:
            metric_timestamp = timestamp.timestamp()

        if project is None:
            project = self.project.id

        if not isinstance(value, list):
            value = [value]

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": project,
                    "metric_id": indexer.resolve(self.organization.id, internal_metric),
                    "timestamp": metric_timestamp,
                    "tags": tags,
                    "type": self.TYPE_MAP[entity],
                    "value": value,
                    "retention_days": 90,
                }
            ],
            entity=entity,
        )

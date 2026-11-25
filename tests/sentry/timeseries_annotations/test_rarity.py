from __future__ import annotations

import math
from unittest import mock

from django.utils import timezone

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.timeseries_annotations.models import AnnotationType, TimeseriesAnnotation
from sentry.timeseries_annotations.rarity import (
    RARITY_LOOKBACK_DAYS,
    annotation_type_counts,
    effective_rarity_window_days,
    rarity_score,
)
from sentry.utils.cache import cache


class RarityScoreTest(TestCase):
    def test_formula_matches_log_rarity(self) -> None:
        assert rarity_score(0) == 1.0
        assert rarity_score(1) == 1.0 / (1.0 + math.log1p(1))
        assert rarity_score(100) == 1.0 / (1.0 + math.log1p(100))
        assert rarity_score(1) > rarity_score(10) > rarity_score(100)

    def test_window_clamped_to_retention(self) -> None:
        with self.options({"system.event-retention-days": 30}):
            assert effective_rarity_window_days(self.organization) == 30
        with self.options({"system.event-retention-days": 180}):
            assert effective_rarity_window_days(self.organization) == RARITY_LOOKBACK_DAYS
        with self.options({"system.event-retention-days": 0}):
            assert effective_rarity_window_days(self.organization) == RARITY_LOOKBACK_DAYS

    def test_counts_by_type_over_lookback_not_chart_window(self) -> None:
        TimeseriesAnnotation.objects.create(
            organization_id=self.organization.id,
            annotation_type=AnnotationType.INBOUND_FILTER_CHANGE,
            description="recent",
            start_timestamp=before_now(days=1),
            created_by_label="system",
        )
        TimeseriesAnnotation.objects.create(
            organization_id=self.organization.id,
            annotation_type=AnnotationType.INBOUND_FILTER_CHANGE,
            description="outside 14d chart, inside 90d rarity",
            start_timestamp=before_now(days=45),
            created_by_label="system",
        )
        TimeseriesAnnotation.objects.create(
            organization_id=self.organization.id,
            annotation_type=AnnotationType.CUSTOM,
            description="rare custom",
            start_timestamp=before_now(days=2),
            created_by_label="system",
        )
        TimeseriesAnnotation.objects.create(
            organization_id=self.organization.id,
            annotation_type=AnnotationType.INBOUND_FILTER_CHANGE,
            description="outside 90d",
            start_timestamp=before_now(days=100),
            created_by_label="system",
        )

        with self.options({"system.event-retention-days": 90}):
            counts, window_days = annotation_type_counts(self.organization)

        assert window_days == 90
        assert counts[AnnotationType.INBOUND_FILTER_CHANGE] == 2
        assert counts[AnnotationType.CUSTOM] == 1

    def test_counts_are_cached(self) -> None:
        TimeseriesAnnotation.objects.create(
            organization_id=self.organization.id,
            annotation_type=AnnotationType.CUSTOM,
            description="x",
            start_timestamp=timezone.now(),
            created_by_label="system",
        )
        cache_key = f"ta:rarity-counts:v1:{self.organization.id}"
        cache.delete(cache_key)

        with self.options({"system.event-retention-days": 90}):
            first, _ = annotation_type_counts(self.organization)
            with mock.patch(
                "sentry.timeseries_annotations.rarity.TimeseriesAnnotation.objects.filter"
            ) as mock_filter:
                second, _ = annotation_type_counts(self.organization)

        assert first == second
        mock_filter.assert_not_called()
        assert cache.get(cache_key) == {str(AnnotationType.CUSTOM): 1}

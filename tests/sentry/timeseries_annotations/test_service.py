from datetime import timedelta
from typing import Any

import pytest
from django.db import IntegrityError
from django.utils import timezone

from sentry.testutils.cases import TestCase
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
)
from sentry.timeseries_annotations.service import (
    TimeseriesAnnotationData,
    create_timeseries_annotation,
)
from sentry.viewer_context import ActorId, ActorType


class CreateTimeseriesAnnotationTest(TestCase):
    def _data(self, **overrides: Any) -> TimeseriesAnnotationData:
        base: dict[str, Any] = dict(
            organization_id=self.organization.id,
            annotation_type=AnnotationType.INBOUND_FILTER_CHANGE,
            description="Enabled legacy-browsers filter",
            start_timestamp=timezone.now(),
        )
        base.update(overrides)
        return TimeseriesAnnotationData(**base)

    def test_system_label_creator(self) -> None:
        annotation = create_timeseries_annotation(
            self._data(created_by_label="inbound_filter", tags={"filter": "legacy-browsers"})
        )
        assert annotation.created_by_label == "inbound_filter"
        assert annotation.created_by_id is None
        assert annotation.created_by_service_account_id is None
        assert annotation.updated_by_label == "inbound_filter"
        assert annotation.tags == {"filter": "legacy-browsers"}

    def test_user_creator(self) -> None:
        annotation = create_timeseries_annotation(
            self._data(created_by=ActorId(ActorType.USER, self.user.id))
        )
        assert annotation.created_by_id == self.user.id
        assert annotation.created_by_service_account_id is None
        assert annotation.created_by_label is None

    def test_from_model_round_trip(self) -> None:
        annotation = create_timeseries_annotation(
            self._data(
                scope=AnnotationScope.SPANS,
                created_by_label="statuspage",
                tags={"impact": "critical"},
            )
        )
        data = TimeseriesAnnotationData.from_model(annotation)
        assert data.id == annotation.id
        assert data.scope == AnnotationScope.SPANS
        assert data.annotation_type == AnnotationType.INBOUND_FILTER_CHANGE
        assert data.created_by_label == "statuspage"
        assert data.created_by is None
        assert data.date_added is not None

    def test_from_model_user_actor_round_trip(self) -> None:
        annotation = create_timeseries_annotation(
            self._data(created_by=ActorId(ActorType.USER, self.user.id))
        )
        data = TimeseriesAnnotationData.from_model(annotation)
        assert data.created_by == ActorId(ActorType.USER, self.user.id)

    def test_two_creators_rejected_by_db(self) -> None:
        # No service-layer guard: the at_most_one_creator constraint is the backstop.
        with pytest.raises(IntegrityError):
            create_timeseries_annotation(
                self._data(
                    created_by=ActorId(ActorType.USER, self.user.id),
                    created_by_label="inbound_filter",
                )
            )

    def test_range_annotation_stored(self) -> None:
        start = timezone.now()
        end = start + timedelta(hours=1)
        annotation = create_timeseries_annotation(
            self._data(
                interval_type=IntervalType.RANGE,
                start_timestamp=start,
                end_timestamp=end,
                annotation_type=AnnotationType.SENTRY_OUTAGE,
            )
        )
        assert annotation.interval_type == IntervalType.RANGE
        assert annotation.end_timestamp == end

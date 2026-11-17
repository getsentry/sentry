from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from enum import IntEnum

from django.db.models import Q
from rest_framework.exceptions import ParseError

from sentry.timeseries_annotations.models import IntervalType

# An enum's API label is its lowercased member name, which is also its `as_choices()` label.


def enum_labels(enum_cls: type[IntEnum]) -> dict[int, str]:
    """Map each enum value to its API label."""
    return {member.value: member.name.lower() for member in enum_cls}


def parse_enum_labels(labels: Iterable[str], enum_cls: type[IntEnum], param: str) -> list[int]:
    """Resolve API label strings to their enum values, or raise a 400."""
    by_label = {member.name.lower(): member.value for member in enum_cls}
    try:
        return [by_label[label] for label in labels]
    except KeyError:
        raise ParseError(detail=f"Invalid {param}: must be one of {sorted(by_label)}")


def window_overlap_query(start: datetime, end: datetime) -> Q:
    """
    Annotations whose interval overlaps [start, end].

    A point (null end) matches only when its start is inside the window. A range matches when it
    starts at or before the window end and either ends at or after the window start or is still
    open (null end).
    """
    point = Q(
        interval_type=IntervalType.POINT, start_timestamp__gte=start, start_timestamp__lte=end
    )
    range_ = Q(interval_type=IntervalType.RANGE, start_timestamp__lte=end) & (
        Q(end_timestamp__gte=start) | Q(end_timestamp__isnull=True)
    )
    return point | range_

from __future__ import annotations

import operator
from collections.abc import Sequence
from datetime import timedelta
from enum import StrEnum


class ModelAgeType(StrEnum):
    OLDEST = "oldest"
    NEWEST = "newest"


model_age_choices = [(ModelAgeType.OLDEST, "oldest"), (ModelAgeType.NEWEST, "newest")]


class AgeComparisonType(StrEnum):
    OLDER = "older"
    NEWER = "newer"


age_comparison_choices = [(AgeComparisonType.OLDER, "older"), (AgeComparisonType.NEWER, "newer")]
age_comparison_map = {AgeComparisonType.OLDER: operator.lt, AgeComparisonType.NEWER: operator.gt}

timeranges = {
    "minute": ("minute(s)", timedelta(minutes=1)),
    "hour": ("hour(s)", timedelta(hours=1)),
    "day": ("day(s)", timedelta(days=1)),
    "week": ("week(s)", timedelta(days=7)),
}


def get_timerange_choices() -> Sequence[tuple[str, str]]:
    return [
        (key, label)
        for key, (label, duration) in sorted(
            timeranges.items(), key=lambda key___label__duration: key___label__duration[1][1]
        )
    ]

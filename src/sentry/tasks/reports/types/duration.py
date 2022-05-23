from typing import NamedTuple

from sentry.tasks.reports.utils.constants import ONE_DAY


class Duration(NamedTuple):
    adjective: str  # e.g. "daily" or "weekly",
    noun: str  # relative to today, e.g. "yesterday" or "this week"
    date_format: str  # date format used for large series x axis labeling


DURATIONS = {(ONE_DAY * 7): Duration("weekly", "this week", "D")}

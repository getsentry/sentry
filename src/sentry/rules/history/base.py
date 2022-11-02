from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Sequence

from sentry.utils.services import Service

if TYPE_CHECKING:
    from sentry.models import Group, Rule
    from sentry.utils.cursors import Cursor, CursorResult


@dataclass(frozen=True)
class RuleGroupHistory:
    group: Group
    count: int
    last_triggered: datetime
    event_id: str | None = None


@dataclass(frozen=True)
class TimeSeriesValue:
    bucket: datetime
    count: int


class RuleHistoryBackend(Service):
    """
    This backend is an interface for storing and retrieving issue alert fire history.
    """

    __all__ = ("record", "fetch_rule_groups_paginated", "fetch_rule_hourly_stats")

    def record(self, rule: Rule, group: Group, event_id: str | None = None) -> None:
        """
        Records an instance of an issue alert being fired for a given group.
        """
        raise NotImplementedError

    def fetch_rule_groups_paginated(
        self, rule: Rule, start: datetime, end: datetime, cursor: Cursor, per_page: int
    ) -> CursorResult[Group]:
        """
        Fetches groups that triggered a rule within a given timeframe, ordered by number of
        times each group fired.
        """
        pass

    def fetch_rule_hourly_stats(
        self, rule: Rule, start: datetime, end: datetime
    ) -> Sequence[TimeSeriesValue]:
        """
        Fetches counts of how often a rule has fired withing a given datetime range, bucketed by
        hour.
        """
        pass

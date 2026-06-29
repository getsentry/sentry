from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

from sentry.utils.services import Service
from sentry.workflow_engine.models.workflow import Workflow

if TYPE_CHECKING:
    from sentry.models.group import Group
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

    __all__ = ("fetch_rule_groups_paginated", "fetch_rule_hourly_stats")

    def fetch_rule_groups_paginated(
        self,
        target: Workflow,
        start: datetime,
        end: datetime,
        cursor: Cursor,
        per_page: int,
        project_id: int | None = None,
    ) -> CursorResult[RuleGroupHistory]:
        """
        Fetches groups that triggered a rule or workflow within a given timeframe, ordered by number of
        times each group fired.
        """
        raise NotImplementedError

    def fetch_rule_hourly_stats(
        self, target: Workflow, start: datetime, end: datetime, project_id: int | None = None
    ) -> Sequence[TimeSeriesValue]:
        """
        Fetches counts of how often a rule has fired withing a given datetime range, bucketed by
        hour.
        """
        raise NotImplementedError

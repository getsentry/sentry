from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

from sentry.utils.services import Service

if TYPE_CHECKING:
    from sentry.models import Group, Rule
    from sentry.utils.cursors import Cursor, CursorResult


@dataclass(frozen=True)
class RuleGroupHistory:
    group: Group
    count: int


class RuleHistoryBackend(Service):
    """
    This backend is an interface for storing and retrieving issue alert fire history.
    """

    __all__ = ("record", "fetch_rule_groups_paginated")

    def record(self, rule: Rule, group: Group) -> None:
        """
        Records an instance of an issue alert being fired for a given group.
        """
        raise NotImplementedError

    def fetch_rule_groups_paginated(
        self, rule: Rule, start: datetime, end: datetime, cursor: Cursor, per_page: int
    ) -> CursorResult:
        """
        Fetches groups that triggered a rule within a given timeframe, ordered by number of
        times each group fired.
        """
        pass

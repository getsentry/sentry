from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.models import RuleFireHistory
from sentry.rules.history.base import RuleHistoryBackend

if TYPE_CHECKING:
    from sentry.models import Group, Rule


class PostgresRuleHistoryBackend(RuleHistoryBackend):
    def record(self, rule: Rule, group: Group) -> None:
        RuleFireHistory.objects.create(project=rule.project, rule=rule, group=group)

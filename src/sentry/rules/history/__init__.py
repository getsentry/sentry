from typing import TYPE_CHECKING

from django.conf import settings

from sentry.rules.history.base import RuleHistoryBackend
from sentry.utils.services import LazyServiceWrapper

LazyServiceWrapper(
    RuleHistoryBackend,
    settings.SENTRY_ISSUE_ALERT_HISTORY,
    settings.SENTRY_ISSUE_ALERT_HISTORY_OPTIONS,
).expose(locals())

if TYPE_CHECKING:
    __rule_history_backend__ = RuleHistoryBackend()
    record = __rule_history_backend__.record
    fetch_rule_groups_paginated = __rule_history_backend__.fetch_rule_groups_paginated
    fetch_rule_hourly_stats = __rule_history_backend__.fetch_rule_hourly_stats

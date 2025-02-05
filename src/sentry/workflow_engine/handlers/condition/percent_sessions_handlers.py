from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, ClassVar

from django.core.cache import cache

from sentry import release_health, tsdb
from sentry.issues.constants import get_issue_tsdb_group_model
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.rules.conditions.event_frequency import (
    COMPARISON_INTERVALS,
    MIN_SESSIONS_TO_FIRE,
    PERCENT_INTERVALS,
    STANDARD_INTERVALS,
)
from sentry.tsdb.base import TSDBModel
from sentry.utils.snuba import options_override
from sentry.workflow_engine.handlers.condition.event_frequency_base_handler import (
    BaseEventFrequencyConditionHandler,
    BaseEventFrequencyCountHandler,
    BaseEventFrequencyPercentHandler,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


class PercentSessionsConditionHandler(BaseEventFrequencyConditionHandler):
    intervals: ClassVar[dict[str, tuple[str, timedelta]]] = PERCENT_INTERVALS

    @classmethod
    def get_base_handler(cls) -> type[BaseEventFrequencyConditionHandler]:
        return PercentSessionsConditionHandler

    def get_session_count(
        self, project_id: int, environment_id: int | None, start: datetime, end: datetime
    ) -> int:
        cache_key = f"r.c.spc:{project_id}-{environment_id}"
        session_count_last_hour = cache.get(cache_key)
        if session_count_last_hour is None:
            with options_override({"consistent": False}):
                session_count_last_hour = release_health.backend.get_project_sessions_count(
                    project_id=project_id,
                    environment_id=environment_id,
                    rollup=60,
                    start=end - timedelta(minutes=60),
                    end=end,
                )

            cache.set(cache_key, session_count_last_hour, 600)
        return session_count_last_hour

    def get_session_interval(self, session_count: int, interval: str) -> int | None:
        if session_count >= MIN_SESSIONS_TO_FIRE:
            interval_in_minutes = PERCENT_INTERVALS[interval][1].total_seconds() // 60
            return int(session_count / (60 / interval_in_minutes))
        return None

    def batch_query(
        self,
        group_ids: set[int],
        start: datetime,
        end: datetime,
        environment_id: int | None,
        interval: str,
    ) -> dict[int, int]:
        batch_percents: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        category_group_ids = self.get_group_ids_by_category(groups)
        project_id = self.get_value_from_groups(groups, "project_id")

        if not project_id:
            return {group["id"]: 0 for group in groups}

        session_count_last_hour = self.get_session_count(project_id, environment_id, start, end)
        avg_sessions_in_interval = self.get_session_interval(session_count_last_hour, interval)

        if not avg_sessions_in_interval:
            return {group["id"]: 0 for group in groups}

        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if not organization_id:
            return batch_percents

        def get_result(model: TSDBModel, group_ids: list[int]) -> dict[int, int]:
            return self.get_chunked_result(
                tsdb_function=tsdb.backend.get_sums,
                model=model,
                group_ids=group_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_frequency",
            )

        for category, issue_ids in category_group_ids.items():
            # We do not have sessions for non-error issue types
            if category != GroupCategory.ERROR:
                for group_id in issue_ids:
                    batch_percents[group_id] = 0
            else:
                model = get_issue_tsdb_group_model(category)
                results = get_result(model, issue_ids)
                for group_id, count in results.items():
                    percent: int = int(100 * round(count / avg_sessions_in_interval, 4))
                    batch_percents[group_id] = percent

        return batch_percents


@condition_handler_registry.register(Condition.PERCENT_SESSIONS_COUNT)
class PercentSessionsCountHandler(
    PercentSessionsConditionHandler,
    BaseEventFrequencyCountHandler,
    DataConditionHandler[WorkflowJob],
):
    comparison_json_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "interval": {"type": "string", "enum": list(STANDARD_INTERVALS.keys())},
            "value": {"type": "number", "minimum": 0, "maximum": 100},
        },
        "required": ["interval", "value"],
        "additionalProperties": False,
    }


@condition_handler_registry.register(Condition.PERCENT_SESSIONS_PERCENT)
class PercentSessionsPercentHandler(
    PercentSessionsConditionHandler,
    BaseEventFrequencyPercentHandler,
    DataConditionHandler[WorkflowJob],
):
    comparison_json_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "interval": {"type": "string", "enum": list(STANDARD_INTERVALS.keys())},
            "value": {"type": "number", "minimum": 0, "maximum": 100},
            "comparison_interval": {"type": "string", "enum": list(COMPARISON_INTERVALS.keys())},
        },
        "required": ["interval", "value", "comparison_interval"],
        "additionalProperties": False,
    }

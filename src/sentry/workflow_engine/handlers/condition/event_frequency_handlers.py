from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sentry import tsdb
from sentry.issues.constants import get_issue_tsdb_group_model
from sentry.models.group import Group
from sentry.rules.conditions.event_frequency import STANDARD_INTERVALS, percent_increase
from sentry.tsdb.base import TSDBModel
from sentry.workflow_engine.handlers.condition.event_frequency_base_handler import (
    BaseEventFrequencyConditionHandler,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DataConditionResult


class EventFrequencyConditionHandler(BaseEventFrequencyConditionHandler):
    @property
    def intervals(self) -> dict[str, tuple[str, timedelta]]:
        return STANDARD_INTERVALS

    def batch_query(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int
    ) -> dict[int, int]:
        batch_sums: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        category_group_ids = self.get_group_ids_by_category(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if not organization_id:
            return batch_sums

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
            model = get_issue_tsdb_group_model(
                category
            )  # TODO: may need to update logic for crons, metric issues, uptime
            batch_sums.update(get_result(model, issue_ids))

        return batch_sums


@condition_handler_registry.register(Condition.EVENT_FREQUENCY_COUNT)
class EventFrequencyCountHandler(EventFrequencyConditionHandler, DataConditionHandler[int]):
    @staticmethod
    def evaluate_value(value: int, comparison: Any) -> DataConditionResult:
        return value > comparison["value"]


@condition_handler_registry.register(Condition.EVENT_FREQUENCY_PERCENT)
class EventFrequencyPercentHandler(EventFrequencyConditionHandler, DataConditionHandler[list[int]]):
    @staticmethod
    def evaluate_value(value: list[int], comparison: Any) -> DataConditionResult:
        if len(value) != 2:
            return False
        return percent_increase(value[0], value[1]) > comparison["value"]

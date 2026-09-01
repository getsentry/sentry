from __future__ import annotations

import operator
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import reduce
from typing import Any, Generic, TypeVar

from django.db.models import Q

from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.group import Group
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.types import (
    ActionFilterDataConditionHandler,
    GroupId,
    WorkflowTriggerDataConditionHandler,
)

PREVIEW_TIME_RANGE = timedelta(weeks=1)
PREVIEW_CANDIDATE_LIMIT = 100


class InvalidPreviewConfiguration(Exception):
    pass


PreviewConditionHandlerT = TypeVar(
    "PreviewConditionHandlerT",
    bound=WorkflowTriggerDataConditionHandler | ActionFilterDataConditionHandler[Any],
)


@dataclass(frozen=True)
class PreviewCondition(Generic[PreviewConditionHandlerT]):
    handler: type[PreviewConditionHandlerT]
    type: Condition
    comparison: Any


@dataclass(frozen=True)
class PreviewConditionGroup(Generic[PreviewConditionHandlerT]):
    logic_type: DataConditionGroup.Type
    conditions: tuple[PreviewCondition[PreviewConditionHandlerT], ...]


@dataclass(frozen=True)
class AlertPreviewCandidate:
    group_id: GroupId
    triggered_at: datetime


@dataclass(frozen=True)
class AlertPreviewResult(AlertPreviewCandidate):
    is_throttled: bool


@dataclass(frozen=True)
class AlertPreview:
    results: tuple[AlertPreviewResult, ...]


@dataclass
class ActionFilterPreviewPlan:
    logic_type: DataConditionGroup.Type
    group_filters: list[Q] = field(default_factory=list)

    def add_group_filter(self, condition: Q) -> None:
        self.group_filters.append(condition)

    def get_group_filter(self) -> Q | None:
        if not self.group_filters:
            return None

        if self.logic_type in (
            DataConditionGroup.Type.ANY,
            DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        ):
            return reduce(operator.or_, self.group_filters)
        if self.logic_type == DataConditionGroup.Type.ALL:
            return reduce(operator.and_, self.group_filters)
        if self.logic_type == DataConditionGroup.Type.NONE:
            return ~reduce(operator.or_, self.group_filters)

        raise InvalidPreviewConfiguration(f"Unsupported logic type: {self.logic_type}")


@dataclass
class AlertPreviewPlan:
    group_candidate_filters: list[Q] = field(default_factory=list)
    group_action_log_candidate_filters: list[Q] = field(default_factory=list)
    action_filter_plans: list[ActionFilterPreviewPlan] = field(default_factory=list)

    def add_group_candidates(self, condition: Q) -> None:
        self.group_candidate_filters.append(condition)

    def add_group_action_log_candidates(self, condition: Q) -> None:
        self.group_action_log_candidate_filters.append(condition)

    def add_action_filter(self, logic_type: DataConditionGroup.Type) -> ActionFilterPreviewPlan:
        plan = ActionFilterPreviewPlan(logic_type=logic_type)
        self.action_filter_plans.append(plan)
        return plan

    def _get_candidates(
        self,
        project_ids: Sequence[int],
        start: datetime,
        end: datetime,
    ) -> list[AlertPreviewCandidate]:
        candidates: list[AlertPreviewCandidate] = []

        if self.group_candidate_filters:
            group_filter = reduce(operator.or_, self.group_candidate_filters)
            groups = (
                Group.objects.filter(
                    project_id__in=project_ids,
                    first_seen__gte=start,
                    first_seen__lt=end,
                )
                .filter(group_filter)
                .order_by("-first_seen", "-id")
                .values_list("id", "first_seen")
            )[:PREVIEW_CANDIDATE_LIMIT]
            candidates.extend(
                AlertPreviewCandidate(
                    group_id=group_id,
                    triggered_at=triggered_at,
                )
                for group_id, triggered_at in groups
            )

        if self.group_action_log_candidate_filters:
            action_log_filter = reduce(operator.or_, self.group_action_log_candidate_filters)
            action_log_entries = (
                GroupActionLogEntry.objects.filter(
                    project_id__in=project_ids,
                    date_added__gte=start,
                    date_added__lt=end,
                )
                .filter(action_log_filter)
                .order_by("-date_added", "-id")
                .values_list("group_id", "date_added")
            )[:PREVIEW_CANDIDATE_LIMIT]
            candidates.extend(
                AlertPreviewCandidate(
                    group_id=group_id,
                    triggered_at=triggered_at,
                )
                for group_id, triggered_at in action_log_entries
            )

        return sorted(candidates, key=lambda candidate: candidate.triggered_at)[
            -PREVIEW_CANDIDATE_LIMIT:
        ]

    @staticmethod
    def _apply_throttling(
        candidates: Sequence[AlertPreviewCandidate], throttling_period: timedelta
    ) -> tuple[AlertPreviewResult, ...]:
        last_triggered_by_group: dict[GroupId, datetime] = {}
        throttled_results: list[AlertPreviewResult] = []

        for candidate in candidates:
            last_triggered = last_triggered_by_group.get(candidate.group_id)
            is_throttled = (
                last_triggered is not None
                and candidate.triggered_at - last_triggered <= throttling_period
            )
            if not is_throttled:
                last_triggered_by_group[candidate.group_id] = candidate.triggered_at
            throttled_results.append(
                AlertPreviewResult(
                    group_id=candidate.group_id,
                    triggered_at=candidate.triggered_at,
                    is_throttled=is_throttled,
                )
            )

        return tuple(reversed(throttled_results))

    def execute(
        self,
        project_ids: Sequence[int],
        end: datetime,
        throttling_period: timedelta,
    ) -> tuple[AlertPreview, ...]:
        candidates = self._get_candidates(
            project_ids,
            end - PREVIEW_TIME_RANGE,
            end,
        )
        candidate_group_ids: set[GroupId] = {candidate.group_id for candidate in candidates}
        previews: list[AlertPreview] = []

        for action_filter_plan in self.action_filter_plans:
            group_filter = action_filter_plan.get_group_filter()
            passing_groups = Group.objects.filter(
                project_id__in=project_ids,
                id__in=candidate_group_ids,
            )
            if group_filter is not None:
                passing_groups = passing_groups.filter(group_filter)

            passing_group_ids = set(passing_groups.values_list("id", flat=True).distinct())
            passing_candidates = [
                candidate for candidate in candidates if candidate.group_id in passing_group_ids
            ]
            previews.append(
                AlertPreview(
                    results=self._apply_throttling(passing_candidates, throttling_period),
                )
            )

        return tuple(previews)


class AlertPreviewBehavior:
    pass


class WorkflowTriggerPreviewBehavior(AlertPreviewBehavior, ABC):
    @abstractmethod
    def add_to_preview(self, plan: AlertPreviewPlan, comparison: Any) -> None:
        raise NotImplementedError


class ActionFilterPreviewBehavior(AlertPreviewBehavior, ABC):
    @abstractmethod
    def filter_preview(self, plan: ActionFilterPreviewPlan, comparison: Any) -> None:
        raise NotImplementedError


@dataclass(frozen=True)
class UnsupportedPreviewBehavior(AlertPreviewBehavior):
    reason: str

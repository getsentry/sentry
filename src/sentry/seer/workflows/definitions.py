from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.workflows.base import AutomationDefinition
from sentry.seer.workflows.breached_metrics import MetricAlertDefinition
from sentry.seer.workflows.scheduled import ScheduleDefinition

DEFINITIONS: Mapping[SeerWorkflowStrategy, AutomationDefinition[Any]] = {
    SeerWorkflowStrategy.AGENTIC_TRIAGE_V2: ScheduleDefinition(),
    SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION: MetricAlertDefinition(),
}


def find_definition(strategy: str) -> AutomationDefinition[Any] | None:
    return DEFINITIONS.get(SeerWorkflowStrategy(strategy))


def get_definition(strategy: str) -> AutomationDefinition[Any]:
    definition = find_definition(strategy)
    if definition is None:
        raise ValueError(f"{strategy} automations have no definition")
    return definition


def is_scheduled(strategy: str) -> bool:
    return isinstance(find_definition(strategy), ScheduleDefinition)

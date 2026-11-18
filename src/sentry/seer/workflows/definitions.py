from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.workflows.base import AutomationConfiguration
from sentry.seer.workflows.breached_metrics import (
    MetricAlertTrigger,
    MetricBreachInputs,
)
from sentry.seer.workflows.scheduled import (
    ScheduledRunInputs,
    ScheduleTrigger,
)

DEFINITIONS: Mapping[SeerWorkflowStrategy, AutomationConfiguration[Any]] = {
    SeerWorkflowStrategy.AGENTIC_TRIAGE_V2: AutomationConfiguration[ScheduledRunInputs](
        trigger=ScheduleTrigger()
    ),
    SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION: AutomationConfiguration[MetricBreachInputs](
        trigger=MetricAlertTrigger()
    ),
}


def find_definition(strategy: str) -> AutomationConfiguration[Any] | None:
    return DEFINITIONS.get(SeerWorkflowStrategy(strategy))


def get_definition(strategy: str) -> AutomationConfiguration[Any]:
    definition = find_definition(strategy)
    if definition is None:
        raise ValueError(f"{strategy} automations have no configurable scope")
    return definition


def is_scheduled(strategy: str) -> bool:
    definition = find_definition(strategy)
    return definition is not None and isinstance(definition.trigger, ScheduleTrigger)

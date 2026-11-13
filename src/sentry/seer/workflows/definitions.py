from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.workflows.base import AutomationDefinition
from sentry.seer.workflows.breached_metrics import (
    InvestigateBreachedMetricAction,
    MetricAlertTrigger,
    MetricBreachInputs,
)
from sentry.seer.workflows.scheduled import (
    PromptedInvestigationAction,
    ScheduledRunInputs,
    ScheduleTrigger,
)

DEFINITIONS: Mapping[SeerWorkflowStrategy, AutomationDefinition[Any]] = {
    SeerWorkflowStrategy.AGENTIC_TRIAGE_V2: AutomationDefinition[ScheduledRunInputs](
        trigger=ScheduleTrigger(), action=PromptedInvestigationAction()
    ),
    SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION: AutomationDefinition[MetricBreachInputs](
        trigger=MetricAlertTrigger(), action=InvestigateBreachedMetricAction()
    ),
}


def find_definition(strategy: str) -> AutomationDefinition[Any] | None:
    return DEFINITIONS.get(SeerWorkflowStrategy(strategy))


def get_definition(strategy: str) -> AutomationDefinition[Any]:
    definition = find_definition(strategy)
    if definition is None:
        raise ValueError(f"{strategy} automations have no trigger or action")
    return definition


def is_scheduled(strategy: str) -> bool:
    definition = find_definition(strategy)
    return definition is not None and isinstance(definition.trigger, ScheduleTrigger)

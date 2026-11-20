from types import MappingProxyType

from sentry.workflow_engine.registry import workflow_settings_registry
from sentry.workflow_engine.types import WorkflowEngineAPIOperation, WorkflowSettings, WorkflowType

_CLOSED_API_AVAILABILITY = MappingProxyType(
    {operation: False for operation in WorkflowEngineAPIOperation}
)


@workflow_settings_registry.register(WorkflowType.ALERT)
class AlertWorkflowSettings(WorkflowSettings):
    pass


@workflow_settings_registry.register(WorkflowType.INBOX)
class InboxWorkflowSettings(WorkflowSettings):
    api_availability = _CLOSED_API_AVAILABILITY


@workflow_settings_registry.register(WorkflowType.SEER_INVESTIGATION)
class SeerInvestigationWorkflowSettings(WorkflowSettings):
    api_availability = _CLOSED_API_AVAILABILITY

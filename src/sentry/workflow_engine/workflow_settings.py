from sentry.workflow_engine.registry import workflow_settings_registry
from sentry.workflow_engine.types import (
    NO_API_OPERATIONS_AVAILABLE,
    WorkflowSettings,
    WorkflowType,
)


@workflow_settings_registry.register(WorkflowType.ALERT)
class AlertWorkflowSettings(WorkflowSettings):
    pass


@workflow_settings_registry.register(WorkflowType.INBOX)
class InboxWorkflowSettings(WorkflowSettings):
    api_availability = NO_API_OPERATIONS_AVAILABLE


@workflow_settings_registry.register(WorkflowType.SEER_INVESTIGATION)
class SeerInvestigationWorkflowSettings(WorkflowSettings):
    api_availability = NO_API_OPERATIONS_AVAILABLE

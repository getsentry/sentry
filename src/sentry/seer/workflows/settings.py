from typing import Any, ClassVar

from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.registry import workflow_settings_registry
from sentry.workflow_engine.types import WorkflowSettings


@workflow_settings_registry.register(Workflow.Type.SEER_INVESTIGATION)
class SeerInvestigationWorkflowSettings(WorkflowSettings):
    config_schema: ClassVar[dict[str, Any]] = {
        **WorkflowSettings.config_schema,
        "title": "Seer Investigation Workflow Schema",
        "properties": {
            **WorkflowSettings.config_schema["properties"],
            "crons": {
                "description": "Cron expressions for when the workflow runs, evaluated in timezone",
                "type": "array",
                "items": {"type": "string", "minLength": 1},
                "minItems": 1,
                # Cadence holds one cron per trigger for now.
                "maxItems": 1,
            },
            "timezone": {
                "description": "IANA timezone name the crons are evaluated in; UTC if unset",
                "type": "string",
                "minLength": 1,
            },
        },
        "dependentRequired": {"timezone": ["crons"]},
    }

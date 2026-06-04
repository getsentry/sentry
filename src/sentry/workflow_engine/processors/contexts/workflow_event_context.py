from __future__ import annotations

import dataclasses
from contextvars import ContextVar
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.models.environment import Environment
    from sentry.models.organization import Organization
    from sentry.workflow_engine.models import Detector


@dataclasses.dataclass(frozen=True)
class WorkflowEventContextData:
    """
    The data in this class is provided by the workflow event being processed in `process_workflows`.
    It is not expected to update this data between different workflows, as it is specific to the single event.

    When to access this data:
    - For any data that is required for logging, debugging, or tracing the workflow execution.
    - Metrics that are related to the workflow execution.

    When to pass in the data instead:
    - When the method's logic depends on the data. This ensures a clear separation of concerns
    and allows us to keep method signatures clean and focused on their specific tasks.

    Attributes:
    - detector: The detector responsible for creating the workflow event that is being processed.
    - organization: The organization that owns the detector.
    - environment: The environment associated with the workflow event. If the workflow is set
    for all environments, this will be the specific environment where the detection occurred.

    A workflow is 'processed' in `process_workflows`, when the triggers and actions
    are being evaluated for the event that is being processed.
    """

    detector: Detector | None = None
    organization: Organization | None = None
    environment: Environment | None = None


WorkflowEventContext: ContextVar[WorkflowEventContextData] = ContextVar(
    "workflow_context", default=WorkflowEventContextData()
)

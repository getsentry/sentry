from __future__ import annotations

import dataclasses
from contextvars import ContextVar
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

if TYPE_CHECKING:
    from sentry.models.environment import Environment
    from sentry.models.organization import Organization
    from sentry.workflow_engine.models import Detector


@dataclasses.dataclass(frozen=True)
class WorkflowContextData:
    id: UUID = uuid4()
    detector: Detector | None = None
    organization: Organization | None = None
    environment: Environment | None = None


# _id is a unique identifier for the workflow context, this can be used in logs to trace a single context
_workflow_context: ContextVar[WorkflowContextData] = ContextVar(
    "workflow_context", default=WorkflowContextData()
)


class WorkflowContext:
    """
    A class to manage different aspects of the workflow. This is used to store
    data that is shared across different steps in the workflow.
    """

    @classmethod
    def set(
        cls,
        context: WorkflowContextData,
    ) -> None:
        _workflow_context.set(context)

    @classmethod
    def get(cls) -> WorkflowContextData:
        return _workflow_context.get()

    @classmethod
    def reset(cls) -> None:
        """
        Reset the workflow context to its default state.
        """
        _workflow_context.set(WorkflowContextData())

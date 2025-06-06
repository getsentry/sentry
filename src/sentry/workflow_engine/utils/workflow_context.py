from __future__ import annotations

import dataclasses
from contextvars import ContextVar
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID, uuid4

if TYPE_CHECKING:
    from sentry.models.environment import Environment
    from sentry.models.organization import Organization
    from sentry.workflow_engine.models import Detector

# _id is a unique identifier for the workflow context, this can be used in logs to trace a single context
_id: ContextVar[UUID] = ContextVar("id", default=uuid4())
_detector: ContextVar[Detector | None] = ContextVar("detector", default=None)
_organization: ContextVar[Organization | None] = ContextVar("organization", default=None)
_environment: ContextVar[Environment | None] = ContextVar("environment", default=None)


@dataclasses.dataclass
class WorkflowContextData:
    id: UUID
    detector: Detector | None = None
    organization: Organization | None = None
    environment: Environment | None = None


WorkflowContextDataKeys = Literal["id", "detector", "workflow", "environment"]


class WorkflowContext:
    """
    A class to manage different aspects of the workflow. This is used to store
    data that is shared across different steps in the workflow.
    """

    @classmethod
    def _check_value(cls, value: Any, variable: ContextVar) -> bool:
        return value is not None or variable.get() is not None and value is None

    @classmethod
    def set(
        cls,
        detector: Detector | None = None,
        organization: Organization | None = None,
        environment: Environment | None = None,
    ) -> None:
        if cls._check_value(detector, _detector):
            _detector.set(detector)

        if cls._check_value(organization, _organization):
            _organization.set(organization)

        if cls._check_value(environment, _environment):
            _environment.set(environment)

    @classmethod
    def get(cls) -> WorkflowContextData:
        return WorkflowContextData(
            id=_id.get(),
            detector=_detector.get(),
            organization=_organization.get(),
            environment=_environment.get(),
        )

    @classmethod
    def get_value(
        cls,
        variable_name: WorkflowContextDataKeys,
    ) -> Any:
        return getattr(cls.get(), variable_name)

    @classmethod
    def reset(cls) -> None:
        # Reset all context variables to None
        cls.set()

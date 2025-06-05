from __future__ import annotations

import dataclasses
from contextvars import ContextVar
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from sentry.models.environment import Environment
    from sentry.models.organization import Organization
    from sentry.workflow_engine.models import Detector


@dataclasses.dataclass
class WorkflowContextData:
    detector: Detector | None = None
    organization: Organization | None = None
    environment: Environment | None = None


class WorkflowContext:
    """
    A class to manage different aspects of the workflow. This is used to store
    data that is shared across different steps in the workflow.
    """

    _detector: ContextVar[Detector | None] = ContextVar("detector", default=None)
    _organization: ContextVar[Organization | None] = ContextVar("organization", default=None)
    _environment: ContextVar[Environment | None] = ContextVar("environment", default=None)

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
        if cls._check_value(detector, cls._detector):
            cls._detector.set(detector)

        if cls._check_value(organization, cls._organization):
            cls._organization.set(organization)

        if cls._check_value(environment, cls._environment):
            cls._environment.set(environment)

    @classmethod
    def get(cls) -> WorkflowContextData:
        return WorkflowContextData(
            detector=cls._detector.get(),
            organization=cls._organization.get(),
            environment=cls._environment.get(),
        )

    @classmethod
    def get_value(
        cls,
        variable_name: Literal["detector", "organization", "environment"],
    ) -> Any:
        return getattr(cls.get(), variable_name)

    @classmethod
    def reset(cls) -> None:
        # Reset all context variables to None
        cls.set()

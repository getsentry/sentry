from abc import ABC, abstractmethod

from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowEventData


class LegacyRegistryHandler(ABC):
    """
    Abstract base class that defines the interface for notification handlers.
    """

    @staticmethod
    @abstractmethod
    def handle_workflow_action(job: WorkflowEventData, action: Action, detector: Detector) -> None:
        """
        Implement this method to handle the specific notification logic for your handler.
        """
        raise NotImplementedError

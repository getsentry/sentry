import logging
from abc import ABC, abstractmethod

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import MetricIssuePOC
from sentry.utils.registry import NoRegistrationExistsError, Registry
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowJob

logger = logging.getLogger(__name__)


class LegacyRegistryInvoker(ABC):
    """
    Abstract base class that defines the interface for notification handlers.
    """

    def __call__(self, job: WorkflowJob, action: Action, detector: Detector) -> None:
        # Here we could add metrics collection or other common functionality
        self.handle_workflow_action(job, action, detector)

    @abstractmethod
    def handle_workflow_action(self, job: WorkflowJob, action: Action, detector: Detector) -> None:
        """
        Implement this method to handle the specific notification logic for your handler.
        """
        pass


group_type_notification_registry = Registry[LegacyRegistryInvoker]()


@action_handler_registry.register(Action.Type.DISCORD)
class NotificationActionHandler(ActionHandler):
    @staticmethod
    def execute(
        job: WorkflowJob,
        action: Action,
        detector: Detector,
    ) -> None:
        try:
            handler = group_type_notification_registry.get(detector.type)
            handler(job, action, detector)
        except NoRegistrationExistsError:
            logger.exception(
                "No notification handler found for detector type: %s",
                detector.type,
                extra={"detector_id": detector.id, "action_id": action.id},
            )
            # Maybe metrics here?


@group_type_notification_registry.register(ErrorGroupType.slug)
class IssueAlertRegistryInvoker(LegacyRegistryInvoker):
    def handle_workflow_action(self, job: WorkflowJob, action: Action, detector: Detector) -> None:
        # TODO(iamrajjoshi): Implement this
        pass


@group_type_notification_registry.register(MetricIssuePOC.slug)
class MetricAlertRegistryInvoker(LegacyRegistryInvoker):
    def handle_workflow_action(self, job: WorkflowJob, action: Action, detector: Detector) -> None:
        # TODO(iamrajjoshi): Implement this
        pass

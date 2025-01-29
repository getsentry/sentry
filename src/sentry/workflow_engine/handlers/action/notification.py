import logging
from typing import Protocol

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import MetricIssuePOC
from sentry.utils.registry import NoRegistrationExistsError, Registry
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowJob

logger = logging.getLogger(__name__)


class NotificationHandler(Protocol):
    """
    A protocol that defines the interface for the method that will invoke the existing notification registry.
    """

    def __call__(self, job: WorkflowJob, action: Action, detector: Detector) -> None: ...


# Register what function to use based on the group type
notification_registry = Registry[NotificationHandler]()


@action_handler_registry.register(Action.Type.DISCORD)
class NotificationActionHandler(ActionHandler):
    @staticmethod
    def execute(
        job: WorkflowJob,
        action: Action,
        detector: Detector,
    ) -> None:
        try:
            handler = notification_registry.get(detector.type)
            handler(job, action, detector)
        except NoRegistrationExistsError:
            logger.exception(
                "No notification handler found for detector type: %s",
                detector.type,
                extra={"detector_id": detector.id, "action_id": action.id},
            )


@notification_registry.register(ErrorGroupType.slug)
def invoke_issue_alert_registry(job: WorkflowJob, action: Action, detector: Detector) -> None:
    # TODO(iamrajjoshi): Implement this
    pass


@notification_registry.register(MetricIssuePOC.slug)
def invoke_metric_alert_registry(job: WorkflowJob, action: Action, detector: Detector) -> None:
    # TODO(iamrajjoshi): Implement this
    pass

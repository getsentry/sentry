from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.actions.notification_action import send_notification_using_rule_registry
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, DetectorType


@action_handler_registry.register(Action.Type.NOTIFICATION)
class NotificationActionHandler(ActionHandler):
    @staticmethod
    def execute(
        self,
        group_event: GroupEvent,
        action: Action,
        detector: Detector,
    ) -> None:
        """
        Sends a notification to the integration configured in the action.

        :param action: Action model instance
        :param group_event: GroupEvent model instance
        """

        # TODO(iamrajjoshi): Add a check to see if the detector belongs to the same project as the group_event
        assert detector.project == group_event.project

        if detector.type == DetectorType.ERROR:
            # We should use the legacy issue alert notification logic
            send_notification_using_rule_registry(action, detector, group_event)
        else:
            # TODO(iamrajjoshi): Implement the logic to invoke Metric Alert Registry
            pass

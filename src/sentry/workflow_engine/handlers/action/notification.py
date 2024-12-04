from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.actions.notification_action import send_notification_using_rule_registry
from sentry.workflow_engine.models import Action, DataSource, DataSourceDetector, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


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
        Sends a notification to the specified integration.

        :param action: Action model instance
        :param group_event: GroupEvent model instance
        """
        # TODO: Implment this in milestone 2

        # Get the detector_id from the group_event's evidence data
        # TODO(iamrajjoshi): Add a check to see if the detector_id is valid
        detector_id = group_event.occurrence.evidence_data.get("detector_id")

        # TODO(iamrajjoshi): Add a check to see if the detector exists
        detector = Detector.objects.get(id=detector_id)
        assert isinstance(detector, Detector)

        # TODO(iamrajjoshi): Add a check to see if the detector belongs to the same project as the group_event
        assert detector.project == group_event.project

        # Determine what registry to use, based on the data source type
        data_source_detector = DataSourceDetector.objects.get(detector=detector)
        assert isinstance(data_source_detector, DataSourceDetector)

        data_source = data_source_detector.data_source
        assert isinstance(data_source, DataSource)

        if data_source.type == "IssueOccurrence":
            send_notification_using_rule_registry(action, detector, group_event)
        else:
            # TODO(iamrajjoshi): Implement the logic to invoke Metric Alert Registry
            pass

from sentry.models.group import GroupEvent
from sentry.workflow_engine.actions.action_handlers_registry import register_action_handler
from sentry.workflow_engine.actions.notification_action.logic import invoke_issue_alert_registry
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.models.data_source import DataSource
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector
from sentry.workflow_engine.models.detector import Detector


@register_action_handler(
    [
        Action.Type.NOTIFICATION_SLACK,
        Action.Type.NOTIFICATION_DISCORD,
        Action.Type.NOTIFICATION_MSTEAMS,
        Action.Type.NOTIFICATION_PAGERDUTY,
        Action.Type.NOTIFICATION_OPSGENIE,
        Action.Type.NOTIFICATION_GITHUB,
        Action.Type.NOTIFICATION_GITHUB_ENTERPRISE,
        Action.Type.NOTIFICATION_GITLAB,
        Action.Type.NOTIFICATION_JIRA,
        Action.Type.NOTIFICATION_JIRA_SERVER,
        Action.Type.NOTIFICATION_AZURE_DEVOPS,
        Action.Type.NOTIFICATION_SENTRY_APP,
        Action.Type.NOTIFICATION_EMAIL,
    ]
)
def notification_action_handler(action: Action, group_event: GroupEvent):
    """
    Sends a notification to the specified integration.

    :param action: Action model instance
    :param group_event: GroupEvent model instance
    """

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
        invoke_issue_alert_registry(action, detector, group_event)
    else:
        # TODO(iamrajjoshi): Implement the logic to invoke Metric Alert Registry
        pass

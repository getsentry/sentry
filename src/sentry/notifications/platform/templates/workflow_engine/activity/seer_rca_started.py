from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.seer_base import (
    WorkflowEngineActivityAction,
    build_template,
    extract_models,
    get_example_template,
    get_issue_description,
    get_subject,
    get_view_in_sentry_button,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SEER_RCA_STARTED)
class SeerRcaStartedActivityTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        source=NotificationSource.ACTIVITY_SEER_RCA_STARTED,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SEER_RCA_STARTED.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return get_example_template("Seer RCA Started for EXAMPLE-1")

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        activity, group, project, organization = extract_models(data)
        return build_template(
            data=data,
            subject=get_subject("Seer RCA Started", group),
            body=get_issue_description(group),
            extra_actions=[get_view_in_sentry_button(group)],
        )

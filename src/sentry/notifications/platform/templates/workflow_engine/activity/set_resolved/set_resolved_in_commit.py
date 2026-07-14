from sentry.models.commit import Commit
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    ActivityAlertAction,
    build_alert_footer,
    build_example_issue_link,
    build_issue_link,
)
from sentry.notifications.platform.templates.workflow_engine.activity.set_resolved.base import (
    get_resolution_subject,
    render_resolution_example,
)
from sentry.notifications.platform.types import (
    BlockQuoteSection,
    CodeTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED_IN_COMMIT)
class SetResolvedInCommitActivityTemplate(NotificationTemplate[ActivityAlertAction]):
    category = NotificationCategory.ALERTS
    example_data = ActivityAlertAction(
        source=NotificationSource.ACTIVITY_SET_RESOLVED_IN_COMMIT,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SET_RESOLVED_IN_COMMIT.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return render_resolution_example(
            body=[
                ParagraphSection(
                    blocks=[
                        build_example_issue_link(),
                        PlainTextBlock(text="was resolved in commit"),
                        CodeTextBlock(text="abc1234"),
                    ]
                ),
            ]
        )

    def render(self, data: ActivityAlertAction) -> NotificationRenderedTemplate:
        from sentry.notifications.notification_action.activity_registry.base import (
            extract_notification_models_by_activity,
        )

        activity, group, project, organization = extract_notification_models_by_activity(
            activity_id=data.activity_id
        )
        extra_body_sections: list[NotificationSection] = []
        resolution_blocks: list[NotificationTextBlock] = [
            PlainTextBlock(text="was resolved in a commit.")
        ]
        if activity.data and "commit" in activity.data:
            try:
                commit = Commit.objects.get(id=activity.data["commit"])
            except Commit.DoesNotExist:
                pass
            else:
                resolution_blocks = [
                    PlainTextBlock(text="was resolved in commit"),
                    CodeTextBlock(text=commit.short_id),
                ]
                if commit.message:
                    extra_body_sections.append(
                        BlockQuoteSection(blocks=[PlainTextBlock(text=commit.message)])
                    )

        return NotificationRenderedTemplate(
            subject=get_resolution_subject(activity, group),
            body=[
                ParagraphSection(
                    blocks=[build_issue_link(group), *resolution_blocks],
                ),
                *extra_body_sections,
            ],
            footer=build_alert_footer(organization=organization, workflow_id=data.workflow_id),
        )

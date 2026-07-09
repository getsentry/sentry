from urllib.parse import urlencode

import orjson
from sentry_relay.processing import parse_release

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
    LinkTextBlock,
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED_IN_RELEASE)
class SetResolvedInReleaseActivityTemplate(NotificationTemplate[ActivityAlertAction]):
    category = NotificationCategory.ALERTS
    example_data = ActivityAlertAction(
        source=NotificationSource.ACTIVITY_SET_RESOLVED_IN_RELEASE,
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
        activity_id=1,
        detector_id=1,
    )

    def render_example(self) -> NotificationRenderedTemplate:
        return render_resolution_example(
            body=[
                ParagraphSection(
                    blocks=[
                        build_example_issue_link(),
                        PlainTextBlock(text="was resolved in release"),
                        LinkTextBlock(
                            text="v1.0.0",
                            url="https://sentry.io/organizations/acme/releases/v1.0.0/",
                        ),
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

        resolution_blocks: list[NotificationTextBlock] = [
            PlainTextBlock(text="was resolved in an upcoming release.")
        ]
        # If version is missing, None or "" -> it was resolved in an upcoming release
        if activity.data and activity.data.get("version"):
            raw_version = activity.data["version"]
            readable_version = parse_release(raw_version, json_loads=orjson.loads)["description"]
            resolution_blocks = [
                PlainTextBlock(text="was resolved in release"),
                LinkTextBlock(
                    text=readable_version or raw_version,
                    url=organization.absolute_url(
                        f"organizations/{organization.slug}/releases/{raw_version}/",
                        query=urlencode({"project": project.id}),
                    ),
                ),
            ]

        return NotificationRenderedTemplate(
            subject=get_resolution_subject(activity, group),
            body=[
                ParagraphSection(
                    blocks=[build_issue_link(group), *resolution_blocks],
                )
            ],
            footer=build_alert_footer(organization=organization, workflow_id=data.workflow_id),
        )

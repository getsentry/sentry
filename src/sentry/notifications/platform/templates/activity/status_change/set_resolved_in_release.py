import orjson
from sentry_relay.processing import parse_release

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    SetResolvedInReleaseNotificationData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.status_change.base import (
    get_status_change_subject,
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


def create_set_resolved_in_release_example() -> SetResolvedInReleaseNotificationData:
    action_data = create_activity_notification_example(
        ActivityType.SET_RESOLVED_IN_RELEASE,
        activity_data={"version": "v1.0.0"},
    )
    return SetResolvedInReleaseNotificationData(
        **action_data.dict(),
        release_url="https://sentry.io/organizations/acme/releases/v1.0.0/",
    )


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED_IN_RELEASE)
class SetResolvedInReleaseActivityTemplate(
    NotificationTemplate[SetResolvedInReleaseNotificationData]
):
    category = NotificationCategory.ACTIVITY
    example_data = create_set_resolved_in_release_example()

    def render(self, data: SetResolvedInReleaseNotificationData) -> NotificationRenderedTemplate:
        resolution_blocks: list[NotificationTextBlock] = [
            PlainTextBlock(text="was resolved in an upcoming release.")
        ]
        if data.activity_data and data.activity_data.get("version"):
            raw_version = data.activity_data["version"]
            readable_version = parse_release(raw_version, json_loads=orjson.loads)["description"]
            if data.release_url:
                resolution_blocks = [
                    PlainTextBlock(text="was resolved in release"),
                    LinkTextBlock(
                        text=readable_version or raw_version,
                        url=data.release_url,
                    ),
                ]

        return NotificationRenderedTemplate(
            subject=get_status_change_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        *resolution_blocks,
                    ],
                ),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )

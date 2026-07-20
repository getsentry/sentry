import orjson
from sentry_relay.processing import parse_release

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.status_change.base import (
    get_status_change_subject,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


def get_regression_blocks(data: ActivityNotificationData) -> list[NotificationTextBlock]:
    if data.activity_data and data.activity_data.get("version"):
        raw_version = data.activity_data["version"]
        readable_version = parse_release(raw_version, json_loads=orjson.loads)["description"]
        return [
            PlainTextBlock(text=f"has regressed in release {readable_version}."),
        ]
    return [PlainTextBlock(text="has regressed.")]


@template_registry.register(NotificationSource.ACTIVITY_SET_REGRESSION)
class SetRegressionActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(
        ActivityType.SET_REGRESSION,
        activity_data={"version": "example-project@1.0.0"},
    )

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_status_change_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        *get_regression_blocks(data),
                    ]
                ),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )

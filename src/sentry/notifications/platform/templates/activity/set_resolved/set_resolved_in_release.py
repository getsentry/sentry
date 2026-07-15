import orjson
from sentry_relay.processing import parse_release

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    SetResolvedInReleaseActionData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
)
from sentry.notifications.platform.templates.activity.set_resolved.base import (
    get_resolution_subject,
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


def create_set_resolved_in_release_example() -> SetResolvedInReleaseActionData:
    action_data = create_activity_notification_example(
        ActivityType.SET_RESOLVED_IN_RELEASE,
        activity_data={"version": "v1.0.0"},
    )
    return SetResolvedInReleaseActionData(
        **action_data.dict(),
        release_url="https://sentry.io/organizations/acme/releases/v1.0.0/",
    )


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED_IN_RELEASE)
class SetResolvedInReleaseActivityTemplate(NotificationTemplate[SetResolvedInReleaseActionData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_set_resolved_in_release_example()

    def render(self, data: SetResolvedInReleaseActionData) -> NotificationRenderedTemplate:
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
            subject=get_resolution_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        *resolution_blocks,
                    ],
                )
            ],
            footer=build_footer(data=data),
        )

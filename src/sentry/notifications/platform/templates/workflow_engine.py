from dataclasses import dataclass

from django.conf import settings

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationBodyTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.utils.http import absolute_uri

SEER_ACTIVITY_TYPES = [
    ActivityType.SEER_RCA_STARTED.value,
    ActivityType.SEER_RCA_COMPLETED.value,
    ActivityType.SEER_SOLUTION_STARTED.value,
    ActivityType.SEER_SOLUTION_COMPLETED.value,
    ActivityType.SEER_CODING_STARTED.value,
    ActivityType.SEER_CODING_COMPLETED.value,
    ActivityType.SEER_PR_CREATED.value,
]

SUPPORTED_ACTIVITY_TYPES = [*SEER_ACTIVITY_TYPES]


class WorkflowEngineActivityAction(NotificationData):
    source: NotificationSource = NotificationSource.WORKFLOW_ENGINE_ACTIVITY_ACTION
    workflow_id: int
    activity_type: int
    # Incompatible with the current pull request thing, so need to expand
    activity_details: dict[str, str]
    notification_uuid: str
    organization_id: int
    detector_id: int
    project_id: int | None = None
    group_id: int | None = None
    group_url: str | None = None


@dataclass
class ActivityNotificationContent:
    subject: str
    body: list[NotificationBodyTextBlock]
    actions: list[NotificationRenderedAction]


@template_registry.register(NotificationSource.WORKFLOW_ENGINE_ACTIVITY_ACTION)
class WorkflowEngineActivityActionTemplate(NotificationTemplate[WorkflowEngineActivityAction]):
    category = NotificationCategory.WORKFLOW_ENGINE
    example_data = WorkflowEngineActivityAction(
        notification_uuid="1234567890",
        workflow_id=1,
        activity_type=1,
        activity_details={"key": "value"},
        organization_id=1,
        project_id=1,
        group_id=1,
        group_url="https://example.com/group",
        detector_id=1,
    )

    def get_seer_content(self, data: WorkflowEngineActivityAction) -> ActivityNotificationContent:
        if data.activity_type not in SEER_ACTIVITY_TYPES:
            raise ValueError(
                f"Routed to seer content for non-seer activity type: {data.activity_type}"
            )
        seer_fallback_text = "Click the link below to view the details in Sentry"
        if not data.group_url:
            raise ValueError("Group URL is required for seer content")
        seer_url = f"{data.group_url}?seerDrawer=true"
        match data.activity_type:
            case ActivityType.SEER_RCA_STARTED.value:
                return ActivityNotificationContent(
                    subject="Seer's finding the root cause...",
                    body=[PlainTextBlock(text="Hopefully something turns out")],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_RCA_COMPLETED.value:
                return ActivityNotificationContent(
                    subject="Seer found the root cause",
                    body=[
                        CodeTextBlock(text=data.activity_details.get("summary", seer_fallback_text))
                    ],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_SOLUTION_STARTED.value:
                return ActivityNotificationContent(
                    subject="Seer is planning a fix...",
                    body=[PlainTextBlock(text="Hopefully something turns out")],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_SOLUTION_COMPLETED.value:
                return ActivityNotificationContent(
                    subject="Seer's solution is ready to review",
                    body=[
                        CodeTextBlock(text=data.activity_details.get("summary", seer_fallback_text))
                    ],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_CODING_STARTED.value:
                return ActivityNotificationContent(
                    subject="Seer is writing the code for the fix...",
                    body=[PlainTextBlock(text="Hopefully something turns out")],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_CODING_COMPLETED.value:
                return ActivityNotificationContent(
                    subject="Seer has proposed a diff",
                    body=[PlainTextBlock(text="Hopefully something turns out")],
                    actions=[NotificationRenderedAction(label="View in Sentry", link=seer_url)],
                )
            case ActivityType.SEER_PR_CREATED.value:
                actions = [NotificationRenderedAction(label="View in Sentry", link=seer_url)]
                for pull_request in data.activity_details.get("pull_requests", []):
                    actions.append(
                        NotificationRenderedAction(label="View PR", link=pull_request.get("url"))
                    )
                return ActivityNotificationContent(
                    subject="Seer has a pull request ready",
                    body=[
                        CodeTextBlock(
                            text=data.activity_details.get("pull_requests", seer_fallback_text)
                        )
                    ],
                    actions=actions,
                )
            case _:
                raise ValueError(f"Unsupported activity type: {data.activity_type}")

    def get_activity_content(
        self, data: WorkflowEngineActivityAction
    ) -> ActivityNotificationContent:
        if data.activity_type not in SUPPORTED_ACTIVITY_TYPES:
            raise ValueError(f"Unsupported activity type: {data.activity_type}")

        if data.activity_type in SEER_ACTIVITY_TYPES:
            return self.get_seer_content(data=data)

        raise ValueError(f"Unsupported activity type: {data.activity_type}")

    def render(self, data: WorkflowEngineActivityAction) -> NotificationRenderedTemplate:
        configuration_url = absolute_uri(
            f"/organizations/{data.organization_id}/monitors/alerts/{data.workflow_id}/"
        )
        footer = "This notification was sent as part of an alert."
        if settings.DEBUG and data.activity_type in SEER_ACTIVITY_TYPES:
            footer += f" Run ID: {data.activity_details.get('run_id')}"

        content = self.get_seer_content(data=data)

        template = NotificationRenderedTemplate(
            subject=content.subject,
            body=[
                ParagraphBlock(
                    blocks=[*content.body, PlainTextBlock(text=json.dumps(data.activity_details))]
                )
            ],
            actions=[
                NotificationRenderedAction(label="View Alert", link=configuration_url),
                *content.actions,
            ],
            footer=footer,
        )
        return template

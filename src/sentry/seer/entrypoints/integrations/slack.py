from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, TypedDict

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.seer import (
    SeerAutofixError,
    SeerAutofixSuccess,
    SeerAutofixUpdate,
)
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.sentry_apps.metrics import SentryAppEventType

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.requests.action import SlackActionRequest
    from sentry.models.group import Group


class SlackEntrypointCachePayload(TypedDict):
    organization_id: int
    project_id: int
    group_id: int
    integration_id: int
    thread_ts: str
    channel_id: str
    group_link: str


@entrypoint_registry.register(key=SeerEntrypointKey.SLACK)
class SlackEntrypoint(SeerEntrypoint[SlackEntrypointCachePayload]):
    key = SeerEntrypointKey.SLACK

    def __init__(
        self,
        slack_request: SlackActionRequest,
        group: Group,
        organization_id: int,
        autofix_stopping_point: AutofixStoppingPoint | None = None,
    ):
        from sentry.integrations.slack.integration import SlackIntegration

        self.slack_request = slack_request
        self.group = group
        self.channel_id = slack_request.channel_id or ""
        self.thread_ts = slack_request.data["message"]["ts"]
        self.organization_id = organization_id
        self.install = SlackIntegration(
            model=slack_request.integration, organization_id=organization_id
        )
        self.autofix_stopping_point = autofix_stopping_point or AutofixStoppingPoint.ROOT_CAUSE

    def on_trigger_autofix_error(self, *, error: str) -> None:
        _send_thread_update(
            install=self.install,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            data=SeerAutofixError(error_message=error),
            ephemeral_user_id=self.slack_request.user_id,
        )

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        _send_thread_update(
            install=self.install,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            data=SeerAutofixSuccess(
                run_id=run_id,
                organization_id=self.organization_id,
                stopping_point=self.autofix_stopping_point,
            ),
            ephemeral_user_id=self.slack_request.user_id,
        )

    def create_autofix_cache_payload(self) -> SlackEntrypointCachePayload:
        return SlackEntrypointCachePayload(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
            organization_id=self.organization_id,
            integration_id=self.install.model.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            group_link=self.group.get_absolute_url(),
        )

    @staticmethod
    def on_autofix_update(
        event_type: SentryAppEventType,
        # TODO(leander): Type this out better
        event_payload: dict[str, Any],
        cache_payload: SlackEntrypointCachePayload,
    ) -> None:
        from sentry.integrations.slack.integration import SlackIntegration

        logging_ctx = {
            "event_type": event_type,
            "cache_payload": cache_payload,
        }
        integration = integration_service.get_integration(
            integration_id=cache_payload["integration_id"],
            organization_id=cache_payload["organization_id"],
            provider=IntegrationProviderSlug.SLACK.value,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            logger.error("integration_not_found", extra=logging_ctx)
            return

        install = SlackIntegration(
            model=integration, organization_id=cache_payload["organization_id"]
        )
        group_link = f'{cache_payload["group_link"]}?seerDrawer=true'

        match event_type:
            case SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED:
                root_cause = event_payload.get("root_cause", {})
                _send_thread_update(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    data=SeerAutofixUpdate(
                        run_id=event_payload["run_id"],
                        organization_id=cache_payload["organization_id"],
                        project_id=cache_payload["project_id"],
                        group_id=cache_payload["group_id"],
                        current_point=AutofixStoppingPoint.ROOT_CAUSE,
                        summary=root_cause.get("description", ""),
                        steps=[step.get("title", "") for step in root_cause.get("steps", [])],
                        group_link=group_link,
                    ),
                )
                return
            case SentryAppEventType.SEER_SOLUTION_COMPLETED:
                solution = event_payload.get("solution", {})
                _send_thread_update(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    data=SeerAutofixUpdate(
                        run_id=event_payload["run_id"],
                        organization_id=cache_payload["organization_id"],
                        project_id=cache_payload["project_id"],
                        group_id=cache_payload["group_id"],
                        current_point=AutofixStoppingPoint.SOLUTION,
                        summary=solution.get("description", ""),
                        steps=[step.get("title", "") for step in solution.get("steps", [])],
                        group_link=group_link,
                    ),
                )
                return
            case SentryAppEventType.SEER_CODING_COMPLETED:
                changes = event_payload.get("changes", [])
                _send_thread_update(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    data=SeerAutofixUpdate(
                        run_id=event_payload["run_id"],
                        organization_id=cache_payload["organization_id"],
                        project_id=cache_payload["project_id"],
                        group_id=cache_payload["group_id"],
                        current_point=AutofixStoppingPoint.CODE_CHANGES,
                        changes=[
                            {
                                "repo_name": change.get("repo_name", ""),
                                "diff": change.get("diff", ""),
                                "title": change.get("title", ""),
                                "description": change.get("description", ""),
                            }
                            for change in changes
                        ],
                        group_link=group_link,
                    ),
                )
            case SentryAppEventType.SEER_PR_CREATED:
                pull_requests = [
                    pr_payload.get("pull_request", {})
                    for pr_payload in event_payload.get("pull_requests", [])
                ]
                summary = pull_requests[0].get("pr_url", "") if pull_requests else None
                _send_thread_update(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    data=SeerAutofixUpdate(
                        run_id=event_payload["run_id"],
                        organization_id=cache_payload["organization_id"],
                        project_id=cache_payload["project_id"],
                        group_id=cache_payload["group_id"],
                        pull_requests=[
                            {
                                "pr_number": pr["pr_number"],
                                "pr_url": pr["pr_url"],
                            }
                            for pr in pull_requests
                        ],
                        summary=summary,
                        current_point=AutofixStoppingPoint.OPEN_PR,
                        group_link=group_link,
                    ),
                )
            case _:
                return


def _send_thread_update(
    *,
    install: SlackIntegration,
    channel_id: str,
    thread_ts: str,
    data: NotificationData,
    ephemeral_user_id: str | None = None,
) -> None:
    """
    Send a message to a Slack thread. Needs to be external to the SlackEntrypoint since
    it's used in both its instance methods and static methods
    """
    provider = provider_registry.get(NotificationProviderKey.SLACK)
    template_cls = template_registry.get(data.source)
    renderable = NotificationService.render_template(
        data=data, template=template_cls(), provider=provider
    )
    # Skip over the notification service for now since threading isn't yet formalized.
    if ephemeral_user_id:
        install.send_threaded_ephemeral_message(
            channel_id=channel_id,
            thread_ts=thread_ts,
            renderable=renderable,
            slack_user_id=ephemeral_user_id,
        )
    else:
        install.send_threaded_message(
            channel_id=channel_id,
            thread_ts=thread_ts,
            renderable=renderable,
        )

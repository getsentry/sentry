from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.slack.renderers.seer_agent import (
    SeerAgentErrorSlackRenderer,
    SeerAgentResponseSlackRenderer,
    SeerAgentWriteApprovalSlackRenderer,
)
from sentry.notifications.platform.slack.renderers.seer_autofix import (
    AUTOFIX_CONFIG,
    SeerAutofixErrorSlackRenderer,
    SeerAutofixTriggerSlackRenderer,
    SeerAutofixUpdateSlackRenderer,
)
from sentry.notifications.platform.templates.seer import SeerAgentResponse
from sentry.notifications.platform.types import NotificationData, NotificationSource

__all__ = (
    "AUTOFIX_CONFIG",
    "SeerAgentErrorSlackRenderer",
    "SeerAgentResponseSlackRenderer",
    "SeerAgentWriteApprovalSlackRenderer",
    "SeerAutofixErrorSlackRenderer",
    "SeerAutofixTriggerSlackRenderer",
    "SeerAutofixUpdateSlackRenderer",
    "get_seer_slack_renderer",
)


_SEER_SLACK_RENDERERS: dict[NotificationSource, type[NotificationRenderer[SlackRenderable]]] = {
    NotificationSource.SEER_AUTOFIX_TRIGGER: SeerAutofixTriggerSlackRenderer,
    NotificationSource.SEER_AUTOFIX_ERROR: SeerAutofixErrorSlackRenderer,
    NotificationSource.SEER_AUTOFIX_UPDATE: SeerAutofixUpdateSlackRenderer,
    NotificationSource.SEER_AGENT_ERROR: SeerAgentErrorSlackRenderer,
    NotificationSource.SEER_AGENT_RESPONSE: SeerAgentResponseSlackRenderer,
}


def get_seer_slack_renderer(
    data: NotificationData,
) -> type[NotificationRenderer[SlackRenderable]]:
    if isinstance(data, SeerAgentResponse) and data.write_approval_scopes:
        return SeerAgentWriteApprovalSlackRenderer
    try:
        return _SEER_SLACK_RENDERERS[data.source]
    except KeyError:
        raise ValueError(f"No Seer Slack renderer registered for {data.source}") from None

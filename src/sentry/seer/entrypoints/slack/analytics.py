from enum import Enum

from sentry import analytics


class SlackSeerAgentConversation(str, Enum):
    AI_ASSISTANT = "ai_assistant"
    DIRECT_MESSAGE = "direct_message"
    APP_MENTION = "app_mention"


@analytics.eventclass("ai.explorer.slack.responded")
class SeerAgentSlackResponded(analytics.Event):
    org_slug: str
    username: str
    thread_ts: str
    prompt_length: int
    run_id: int
    integration_id: int
    messages_in_thread: int
    seer_msgs_in_thread: int
    unique_users_in_thread: int
    conversation_type: SlackSeerAgentConversation


def record_seer_slack_event(
    *,
    org_slug: str,
    username: str,
    thread_ts: str,
    prompt_length: int,
    run_id: int,
    integration_id: int,
    messages_in_thread: int,
    seer_msgs_in_thread: int,
    unique_users_in_thread: int,
    conversation_type: SlackSeerAgentConversation,
):
    """Records a Slack event for a Seer Explorer agent."""
    analytics.record(
        SeerAgentSlackResponded(
            org_slug=org_slug,
            username=username,
            thread_ts=thread_ts,
            prompt_length=prompt_length,
            run_id=run_id,
            integration_id=integration_id,
            messages_in_thread=messages_in_thread,
            seer_msgs_in_thread=seer_msgs_in_thread,
            unique_users_in_thread=unique_users_in_thread,
            conversation_type=conversation_type,
        )
    )

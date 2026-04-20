from enum import Enum

from sentry import analytics


class SlackSeerAgentConversation(str, Enum):
    DIRECT_MESSAGE = "direct_message"
    APP_MENTION = "app_mention"


@analytics.eventclass("ai.explorer.slack.responded")
class SlackSeerAgentResponded(analytics.Event):
    org_slug: str
    username: str
    thread_ts: str
    prompt_length: int
    run_id: int
    integration_id: int
    messages_in_thread: int
    seer_msgs_in_thread: int
    unique_users_in_thread: int
    linked_users_in_thread: int
    conversation_type: SlackSeerAgentConversation


analytics.register(SlackSeerAgentResponded)

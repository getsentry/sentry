from enum import Enum

from sentry import analytics


class SlackSeerAgentConversation(str, Enum):
    DIRECT_MESSAGE = "direct_message"
    APP_MENTION = "app_mention"


@analytics.eventclass("ai.agent.slack.responded")
class SlackSeerAgentResponded(analytics.Event):
    organization_id: int
    org_slug: str
    user_id: int
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


@analytics.eventclass("ai.agent.slack.feedback")
class SlackSeerAgentFeedback(analytics.Event):
    organization_id: int
    org_slug: str
    thread_ts: str
    user_id: int
    username: str
    feedback_type: str
    run_id: int
    integration_id: int


analytics.register(SlackSeerAgentFeedback)

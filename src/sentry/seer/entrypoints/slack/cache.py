from typing import TypedDict

from sentry.utils.cache import cache

AGENT_MESSAGE_CACHE_TIMEOUT_SECONDS = 60 * 60 * 24  # 1 day


class SlackSeerAgentMessageCachePayload(TypedDict):
    thread_ts: str
    run_id: int


class SlackSeerAgentMessageCache:
    """
    A cache for messages sent by the Seer Agent, keyed on their slack data.
    Used to lookup messages when processing reactions and associating feedback.
    """

    @classmethod
    def _get_cache_key(cls, *, integration_id: int, channel_id: str, message_ts: str) -> str:
        return f"slack:seer-agent:message:{integration_id}:{channel_id}:{message_ts}"

    @classmethod
    def set(
        cls,
        *,
        integration_id: int,
        channel_id: str,
        message_ts: str,
        payload: SlackSeerAgentMessageCachePayload,
    ) -> None:
        cache.set(
            cls._get_cache_key(
                integration_id=integration_id,
                channel_id=channel_id,
                message_ts=message_ts,
            ),
            payload,
            timeout=AGENT_MESSAGE_CACHE_TIMEOUT_SECONDS,
        )

    @classmethod
    def get(
        cls, *, integration_id: int, channel_id: str, message_ts: str
    ) -> SlackSeerAgentMessageCachePayload | None:
        return cache.get(
            cls._get_cache_key(
                integration_id=integration_id,
                channel_id=channel_id,
                message_ts=message_ts,
            ),
        )

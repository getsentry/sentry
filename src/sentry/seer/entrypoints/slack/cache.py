from typing import NotRequired, TypedDict

from sentry.utils.cache import cache

AGENT_MESSAGE_CACHE_TIMEOUT_SECONDS = 60 * 60 * 24  # 1 day


class SlackSeerAgentMessageCachePayload(TypedDict):
    thread_ts: str
    run_id: int
    input_id: NotRequired[str]


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


class SlackSeerAgentReply(TypedDict):
    message_ts: str


class SlackSeerAgentReplyCache:
    """
    The Seer Agent replies posted for a run, keyed by the answer's block id, "approval:<input id>",
    or "error". It's the only record of what was posted: if it expires or is evicted, or a worker
    dies between posting and recording, the next refresh posts that reply again.
    """

    @classmethod
    def _get_cache_key(cls, *, run_id: int) -> str:
        return f"slack:seer-agent:replies:{run_id}"

    @classmethod
    def get(cls, *, run_id: int) -> dict[str, SlackSeerAgentReply]:
        return cache.get(cls._get_cache_key(run_id=run_id)) or {}

    @classmethod
    def set(cls, *, run_id: int, key: str, reply: SlackSeerAgentReply) -> None:
        cache_key = cls._get_cache_key(run_id=run_id)
        replies = cache.get(cache_key) or {}
        replies[key] = reply
        cache.set(cache_key, replies, timeout=AGENT_MESSAGE_CACHE_TIMEOUT_SECONDS)

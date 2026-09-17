import hashlib
import logging
import re
from collections.abc import Collection, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from django.db.models import F
from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_sdk import trace

from sentry.ai_monitoring.message_normalizer import (
    FILTERED,
    normalize_to_messages,
    stringify_message_content,
)
from sentry.ai_monitoring.models import AIConversationMetadata
from sentry.models.organization import Organization
from sentry.seer.oneshot import run_oneshot
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MAX_USER_MESSAGE_CHARS = 8 * 1024
TITLE_MAX_LENGTH = 256
TITLE_MAX_WORDS = 12
UNTITLED = "Untitled conversation"
LEGACY_GEN_AI_REQUEST_MESSAGES = "gen_ai.request.messages"
# Matches AIConversationMetadata.conversation_id max_length.
CONVERSATION_ID_MAX_LENGTH = 2048
CONVERSATION_ID_TRUNCATE_TO = 2040
# Priority matches organization_ai_conversations list helpers.
_MESSAGE_ATTRS = (
    ATTRIBUTE_NAMES.GEN_AI_INPUT_MESSAGES,
    LEGACY_GEN_AI_REQUEST_MESSAGES,
)


@dataclass(frozen=True, slots=True)
class ConversationTitleSpanData:
    conversation_id: str
    source_timestamp: datetime
    first_user_message: str


def conversation_id_hash(conversation_id: str) -> str:
    return hashlib.sha256(conversation_id.encode()).hexdigest()


def clamp_conversation_id_for_storage(conversation_id: str) -> str:
    """Keep the full id for hashing; only the stored CharField needs this clamp."""
    if len(conversation_id) <= CONVERSATION_ID_MAX_LENGTH:
        return conversation_id
    return conversation_id[:CONVERSATION_ID_TRUNCATE_TO] + "..."


# Earliest title source wins (closest to the first user message); project_id breaks ties.
TITLE_ORDER_BY = (F("title_source_timestamp").asc(nulls_last=True), "project_id")


def fetch_conversation_titles(
    conversation_project_pairs: Collection[tuple[str, int]],
) -> dict[str, str]:
    """One title per conversation_id among the given (conversation_id, project_id) pairs.

    Only requested pairs are considered (ids are unique per project). Among those,
    earliest ``title_source_timestamp`` wins; ``project_id`` breaks ties.
    """
    if not conversation_project_pairs:
        return {}

    requested_pairs = set(conversation_project_pairs)
    conversation_id_by_hash = {
        conversation_id_hash(conversation_id): conversation_id
        for conversation_id, _ in requested_pairs
    }

    rows = (
        AIConversationMetadata.objects.filter(
            project_id__in={project_id for _, project_id in requested_pairs},
            conversation_id_hash__in=conversation_id_by_hash,
            title__isnull=False,
        )
        .exclude(title="")
        .order_by(*TITLE_ORDER_BY)
        .values_list("conversation_id_hash", "project_id", "title")
    )

    titles: dict[str, str] = {}
    for row_hash, project_id, title in rows:
        if title is None:
            continue
        conversation_id = conversation_id_by_hash[row_hash]
        if (conversation_id, project_id) in requested_pairs:
            titles.setdefault(conversation_id, title)
    return titles


def fetch_conversation_title(
    conversation_id: str,
    project_ids: Collection[int],
) -> AIConversationMetadata | None:
    """Look up the titled metadata row for one conversation across the given projects.

    A conversation id is only unique within a project, so the same id can be titled in
    several projects. The earliest title wins: titles come from the first user message,
    so the smallest ``title_source_timestamp`` is the one closest to the start of the
    conversation. Ordering happens in the database; ``project_id`` only breaks ties.
    """
    if not project_ids:
        return None

    return (
        AIConversationMetadata.objects.filter(
            project_id__in=set(project_ids),
            conversation_id_hash=conversation_id_hash(conversation_id),
            title__isnull=False,
        )
        .exclude(title="")
        .order_by(*TITLE_ORDER_BY)
        .first()
    )


def _extract_first_user_message(messages: Any) -> str | None:
    if isinstance(messages, str) and messages == FILTERED:
        return None
    parsed = normalize_to_messages(messages, "user")
    if not parsed:
        return None
    # Clients often prepend context as user messages, so the last user message is usually relevant.
    for msg in reversed(parsed):
        if msg.get("role") != "user":
            continue
        content = stringify_message_content(msg.get("content"))
        if content and content != FILTERED:
            return content
    return None


def conversation_id_from_span(span: Mapping[str, Any]) -> str | None:
    """Cheap check: the gen_ai conversation id, if this span carries one."""
    raw = attribute_value(span, ATTRIBUTE_NAMES.GEN_AI_CONVERSATION_ID)
    if raw is None:
        return None
    conversation_id = str(raw).strip()
    return conversation_id or None


def first_user_message_from_span(span: Mapping[str, Any]) -> str | None:
    for key in _MESSAGE_ATTRS:
        messages = attribute_value(span, key)
        if not messages:
            continue
        first_user = _extract_first_user_message(messages)
        if first_user:
            return first_user
    return None


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _parse_timestamp(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return _as_utc(raw)
    if isinstance(raw, int | float):
        return datetime.fromtimestamp(float(raw), tz=UTC)
    if isinstance(raw, str):
        try:
            return _as_utc(datetime.fromisoformat(raw.replace("Z", "+00:00")))
        except (ValueError, TypeError):
            return None
    return None


def span_source_timestamp(span: Mapping[str, Any]) -> datetime | None:
    return _parse_timestamp(span.get("start_timestamp"))


def clamp_user_message(message: str) -> str:
    return message[:MAX_USER_MESSAGE_CHARS]


def _finalize_title(title: str) -> str:
    cleaned = title.strip().strip("\"'`")
    cleaned = re.sub(r"[\r\n]+", " ", cleaned)
    cleaned = " ".join(cleaned.split())
    if not cleaned:
        return UNTITLED
    if len(cleaned) > TITLE_MAX_LENGTH:
        return cleaned[: TITLE_MAX_LENGTH - 3].rstrip() + "..."
    return cleaned


def fallback_title_from_message(message: str) -> str:
    """Truncate first user message into a stable title when Seer is unavailable."""
    words = message.split()
    if not words:
        return UNTITLED
    if len(words) <= TITLE_MAX_WORDS:
        return _finalize_title(message)
    return _finalize_title(" ".join(words[:TITLE_MAX_WORDS]) + "...")


@trace
def generate_title_with_seer(first_user_message: str, organization: Organization) -> str | None:
    try:
        result = run_oneshot(
            "conversation_title",
            {"first_user_message": clamp_user_message(first_user_message)},
            organization,
            timeout=20,
        )
    except Exception:
        logger.exception("ai_monitoring.conversation_title.seer_request_failed")
        metrics.incr("ai_monitoring.conversation_title.seer", tags={"result": "request_error"})
        return None

    title = result.get("title")
    if not isinstance(title, str) or not title.strip():
        metrics.incr("ai_monitoring.conversation_title.seer", tags={"result": "empty_content"})
        return None

    metrics.incr("ai_monitoring.conversation_title.seer", tags={"result": "success"})
    return _finalize_title(title)


def generate_conversation_title(first_user_message: str, organization: Organization) -> str:
    """Generate a title via Seer, falling back to truncated message text."""
    return generate_title_with_seer(
        first_user_message, organization
    ) or fallback_title_from_message(first_user_message)

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from taskbroker_client.constants import CompressionType
from taskbroker_client.retry import Retry

from sentry import features
from sentry.ai_monitoring.models import AIConversationMetadata
from sentry.ai_monitoring.utils import (
    ConversationTitleSpanData,
    clamp_conversation_id_for_storage,
    clamp_user_message,
    conversation_id_from_span,
    conversation_id_hash,
    first_user_message_from_span,
    generate_conversation_title,
    span_source_timestamp,
)
from sentry.models.project import Project
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ai_agent_monitoring_tasks
from sentry.utils import metrics


def _is_earliest(source_ts: datetime) -> Q:
    """Rows this source is allowed to overwrite: untitled, or titled from a later span."""
    return Q(title_source_timestamp__isnull=True) | Q(title_source_timestamp__gt=source_ts)


@instrumented_task(
    name="sentry.ai_monitoring.tasks.generate_ai_conversation_title",
    namespace=ai_agent_monitoring_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=40,
    compression_type=CompressionType.ZSTD,  # first_user_message can be up to ~8KB of text
    retry=Retry(times=3, delay=5, on=(Exception,)),
)
def generate_ai_conversation_title(
    project_id: int,
    conversation_id: str,
    first_user_message: str,
    source_timestamp: float,
) -> None:
    """Generate and persist the title for a single gen_ai conversation (earliest span wins)."""
    source_ts = datetime.fromtimestamp(source_timestamp, tz=UTC)

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        metrics.incr("ai_monitoring.conversation_title.skip", tags={"reason": "project_not_found"})
        return

    organization = project.organization
    if not features.has("organizations:gen-ai-conversation-title-generation", organization):
        metrics.incr("ai_monitoring.conversation_title.skip", tags={"reason": "feature_disabled"})
        return
    if organization.get_option("sentry:hide_ai_features"):
        metrics.incr("ai_monitoring.conversation_title.skip", tags={"reason": "hide_ai_features"})
        return

    conv_hash = conversation_id_hash(conversation_id)
    qs = AIConversationMetadata.objects.filter(
        project_id=project_id,
        conversation_id_hash=conv_hash,
    )

    # Skip Seer if we already have a title from an earlier-or-equal span.
    existing = qs.first()
    if (
        existing is not None
        and existing.title_source_timestamp is not None
        and source_ts >= existing.title_source_timestamp
    ):
        metrics.incr("ai_monitoring.conversation_title.skip", tags={"reason": "later_or_equal_ts"})
        return

    title = generate_conversation_title(
        first_user_message, viewer_context=SeerViewerContext(organization_id=organization.id)
    )
    stored_conversation_id = clamp_conversation_id_for_storage(conversation_id)

    # Update an existing row only if this span is still the earliest.
    if qs.filter(_is_earliest(source_ts)).update(
        title=title,
        conversation_id=stored_conversation_id,
        title_source_timestamp=source_ts,
    ):
        metrics.incr("ai_monitoring.conversation_title.written", tags={"result": "updated"})
        return

    try:
        # Savepoint so a failed insert doesn't break an enclosing transaction.
        with transaction.atomic(router.db_for_write(AIConversationMetadata)):
            AIConversationMetadata.objects.create(
                project_id=project_id,
                conversation_id=stored_conversation_id,
                conversation_id_hash=conv_hash,
                title=title,
                title_source_timestamp=source_ts,
            )
    except IntegrityError:
        # Another task created the row first; keep our title only if it's earlier.
        if qs.filter(_is_earliest(source_ts)).update(
            title=title,
            title_source_timestamp=source_ts,
        ):
            metrics.incr(
                "ai_monitoring.conversation_title.written", tags={"result": "updated_after_race"}
            )
        else:
            metrics.incr(
                "ai_monitoring.conversation_title.skip", tags={"reason": "lost_create_race"}
            )
        return

    metrics.incr("ai_monitoring.conversation_title.written", tags={"result": "created"})


def spawn_conversation_title_generation(
    spans: Sequence[Mapping[str, Any]], project: Project
) -> None:
    """Spawn one title-generation task per conversation (earliest user message wins)."""
    organization = project.organization
    if not features.has(
        "organizations:gen-ai-conversation-title-generation", organization
    ) or organization.get_option("sentry:hide_ai_features"):
        return

    earliest_by_conversation: dict[str, ConversationTitleSpanData] = {}

    for span in spans:
        conversation_id = conversation_id_from_span(span)
        if conversation_id is None:
            continue

        source_timestamp = span_source_timestamp(span)
        if source_timestamp is None:
            continue

        # Later/equal spans cannot win; skip costly message extraction.
        current = earliest_by_conversation.get(conversation_id)
        if current is not None and source_timestamp >= current.source_timestamp:
            continue

        first_user_message = first_user_message_from_span(span)
        if first_user_message is None:
            continue

        earliest_by_conversation[conversation_id] = ConversationTitleSpanData(
            conversation_id=conversation_id,
            source_timestamp=source_timestamp,
            first_user_message=first_user_message,
        )

    for data in earliest_by_conversation.values():
        generate_ai_conversation_title.delay(
            project_id=project.id,
            conversation_id=data.conversation_id,
            first_user_message=clamp_user_message(data.first_user_message),
            source_timestamp=data.source_timestamp.timestamp(),
        )
        metrics.incr("ai_monitoring.conversation_title.enqueued")

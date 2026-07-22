from collections.abc import Mapping
from datetime import datetime
from typing import Any

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from taskbroker_client.constants import CompressionType
from taskbroker_client.retry import Retry

from sentry import features
from sentry.ai_monitoring.models import AIConversationMetadata
from sentry.ai_monitoring.utils import (
    clamp_conversation_id_for_storage,
    conversation_id_hash,
    generate_conversation_title,
    parse_conversation_title_span,
)
from sentry.models.project import Project
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ai_agent_monitoring_tasks
from sentry.utils import metrics


def _can_replace_title(source_timestamp: datetime) -> Q:
    """Rows we are allowed to overwrite: no title yet, or a strictly later source."""
    return Q(title_source_timestamp__isnull=True) | Q(title_source_timestamp__gt=source_timestamp)


@instrumented_task(
    name="sentry.ai_monitoring.tasks.generate_ai_conversation_title",
    namespace=ai_agent_monitoring_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=40,
    compression_type=CompressionType.ZSTD,  # span payloads can get large
    retry=Retry(times=3, delay=5, on=(Exception,)),
)
def generate_ai_conversation_title(span: Mapping[str, Any]) -> None:
    """
    Generate and persist a conversation title from an ingested gen_ai span.

    Earliest source span wins. Equal timestamps keep the existing title (retry-stable).
    Seer is never called under a DB lock: cheap precheck → generate → conditional write.
    """
    data = parse_conversation_title_span(span)
    if data is None:
        metrics.incr("ai_monitoring.conversation_title.skip", tags={"reason": "invalid_span"})
        return

    try:
        project = Project.objects.get_from_cache(id=data.project_id)
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

    # Hash the full id first; only the stored CharField is length-capped.
    conv_hash = conversation_id_hash(data.conversation_id)
    conversation_id = clamp_conversation_id_for_storage(data.conversation_id)
    existing = AIConversationMetadata.objects.filter(
        project_id=data.project_id,
        conversation_id_hash=conv_hash,
    ).first()
    # Skip Seer when we already have an earlier-or-equal title source.
    if (
        existing is not None
        and existing.title_source_timestamp is not None
        and data.source_timestamp >= existing.title_source_timestamp
    ):
        metrics.incr("ai_monitoring.conversation_title.skip", tags={"reason": "later_or_equal_ts"})
        return

    viewer_context = SeerViewerContext(organization_id=organization.id)
    title = generate_conversation_title(data.first_user_message, viewer_context=viewer_context)

    qs = AIConversationMetadata.objects.filter(
        project_id=data.project_id,
        conversation_id_hash=conv_hash,
    )
    # Atomic conditional update: only overwrite later (or missing) source timestamps.
    if qs.filter(_can_replace_title(data.source_timestamp)).update(
        title=title,
        conversation_id=conversation_id,
        title_source_timestamp=data.source_timestamp,
    ):
        metrics.incr("ai_monitoring.conversation_title.written", tags={"result": "updated"})
        return

    try:
        # Savepoint so IntegrityError doesn't abort an outer transaction.
        with transaction.atomic(router.db_for_write(AIConversationMetadata)):
            AIConversationMetadata.objects.create(
                project_id=data.project_id,
                conversation_id=conversation_id,
                conversation_id_hash=conv_hash,
                title=title,
                title_source_timestamp=data.source_timestamp,
            )
    except IntegrityError:
        # Concurrent create won the insert; only keep our title if we're still earlier.
        if qs.filter(_can_replace_title(data.source_timestamp)).update(
            title=title,
            title_source_timestamp=data.source_timestamp,
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

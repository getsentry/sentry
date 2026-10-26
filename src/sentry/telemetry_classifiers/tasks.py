from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.utils.timezone import now as timezone_now

from sentry import options
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.silo.base import SiloMode
from sentry.snuba.spans_rpc import Spans
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_classifiers_tasks
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

_SCAN_INTERVAL_MINUTES = 5
_COOLDOWN = timedelta(minutes=20)
_DEDUPE_TTL_SECONDS = 60 * 60


@dataclass(frozen=True)
class _ConversationRef:
    project_id: int
    conversation_id: str
    version: str


def _scan_window(scan_time: datetime) -> tuple[datetime, datetime]:
    window_end = scan_time - _COOLDOWN
    return window_end - timedelta(minutes=_SCAN_INTERVAL_MINUTES), window_end


def _fetch_conversations(
    project: Project,
    scan_time: datetime,
    limit: int,
) -> list[_ConversationRef]:
    window_start, window_end = _scan_window(scan_time)
    # Query through scan time so max(timestamp) excludes conversations still active
    # during cooldown.
    result = Spans.run_table_query(
        params=SnubaParams(
            start=window_start,
            end=scan_time,
            projects=[project],
            organization=project.organization,
        ),
        query_string=(
            "has:gen_ai.conversation.id has:gen_ai.operation.type "
            f"max(timestamp):>={int(window_start.timestamp())} "
            f"max(timestamp):<{int(window_end.timestamp())}"
        ),
        selected_columns=["gen_ai.conversation.id", "max(timestamp)"],
        orderby=["max(timestamp)", "gen_ai.conversation.id"],
        offset=0,
        limit=limit,
        referrer="telemetry_classifiers.conversations",
        config=SearchResolverConfig(
            auto_fields=True,
            disable_aggregate_extrapolation=True,
        ),
        sampling_mode="HIGHEST_ACCURACY",
    )

    return [
        _ConversationRef(
            project_id=project.id,
            conversation_id=row["gen_ai.conversation.id"],
            version=str(row["max(timestamp)"]),
        )
        for row in result.get("data", [])
    ]


def _claim_conversations(conversations: list[_ConversationRef]) -> int:
    if not conversations:
        return 0

    client = redis_clusters.get("default")
    with client.pipeline(transaction=False) as pipeline:
        for conversation in conversations:
            digest = hashlib.sha256(
                f"{conversation.conversation_id}\0{conversation.version}".encode()
            ).hexdigest()
            pipeline.set(
                f"telemetry-classifiers:conversation:{conversation.project_id}:{digest}",
                b"1",
                ex=_DEDUPE_TTL_SECONDS,
                nx=True,
            )
        return sum(bool(claimed) for claimed in pipeline.execute())


@instrumented_task(
    name="sentry.telemetry_classifiers.tasks.schedule_conversation_classifiers",
    namespace=telemetry_classifiers_tasks,
    expires=300,
    silo_mode=SiloMode.CELL,
)
def schedule_conversation_classifiers() -> None:
    """Fetch and deduplicate inactive conversations from enrolled projects."""
    project_ids = options.get("classifiers.conversations.project-ids")
    telemetry_limit = options.get("classifiers.conversations.telemetry-limit")
    if not project_ids or telemetry_limit <= 0:
        return

    now = timezone_now()
    scan_time = now.replace(
        minute=now.minute - now.minute % _SCAN_INTERVAL_MINUTES,
        second=0,
        microsecond=0,
    )
    window_start, window_end = _scan_window(scan_time)
    fetched_count = 0
    claimed_count = 0

    projects = (
        Project.objects.filter(
            id__in=project_ids,
            organization__status=ObjectStatus.ACTIVE,
            status=ObjectStatus.ACTIVE,
        )
        .select_related("organization")
        .order_by("id")
    )
    for project in projects:
        conversations = _fetch_conversations(project, scan_time, telemetry_limit)
        fetched_count += len(conversations)
        claimed_count += _claim_conversations(conversations)

    logger.info(
        "telemetry_classifiers.conversations.fetched",
        extra={
            "fetched_count": fetched_count,
            "claimed_count": claimed_count,
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
        },
    )

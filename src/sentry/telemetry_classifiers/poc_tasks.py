from __future__ import annotations

import hashlib
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, TypedDict

from django.utils.timezone import now as timezone_now
from sentry_sdk import traces
from taskbroker_client.retry import Retry

from sentry import options
from sentry.ai_monitoring.message_normalizer import normalize_to_messages
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.seer.oneshot import run_oneshot
from sentry.silo.base import SiloMode
from sentry.snuba.spans_rpc import Spans
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_classifiers_tasks
from sentry.telemetry_classifiers.eap.producer import produce_enrichment_attributes
from sentry.utils import metrics
from sentry.utils.redis import redis_clusters
from sentry.viewer_context import Actor, ActorType, ViewerContext, viewer_context_scope

logger = logging.getLogger(__name__)

_SCAN_INTERVAL_MINUTES = 5
_COOLDOWN = timedelta(minutes=20)
_DEDUPE_TTL_SECONDS = 60 * 60
_CONVERSATION_LOOKBACK = timedelta(days=30)
_MAX_SOURCE_SPANS = 1_000
_MAX_INPUT_CHARS = 32_000
_CLASSIFIER = "user_frustration"
_ONESHOT_ID = "conversation_user_frustration"
_MESSAGE_FIELD = "gen_ai.input.messages"
_POC_RETENTION_DAYS = 30
_POC_USER_FRUSTRATION_ATTRIBUTE = "sentry.enrichment.poc_user_frustration"


@dataclass(frozen=True)
class _ConversationRef:
    project_id: int
    conversation_id: str
    last_span_timestamp: float


class _ClassifierMessage(TypedDict):
    role: Literal["user"]
    content: str


class _ConversationContext(TypedDict):
    organization_id: int
    project_id: int
    conversation_id: str
    last_span_timestamp: float


def _scan_window(scan_time: datetime) -> tuple[datetime, datetime]:
    window_end = scan_time - _COOLDOWN
    return window_end - timedelta(minutes=_SCAN_INTERVAL_MINUTES), window_end


@traces.trace
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
            last_span_timestamp=float(row["max(timestamp)"]),
        )
        for row in result.get("data", [])
    ]


def _claim_conversations(conversations: list[_ConversationRef]) -> list[_ConversationRef]:
    if not conversations:
        return []

    client = redis_clusters.get("default")
    with client.pipeline(transaction=False) as pipeline:
        for conversation in conversations:
            digest = hashlib.sha256(
                f"{conversation.conversation_id}\0{conversation.last_span_timestamp}".encode()
            ).hexdigest()
            pipeline.set(
                f"telemetry-classifiers:conversation:{conversation.project_id}:{digest}",
                b"1",
                ex=_DEDUPE_TTL_SECONDS,
                nx=True,
            )
        return [
            conversation
            for conversation, claimed in zip(conversations, pipeline.execute())
            if claimed
        ]


def _user_messages_from_rows(
    rows: Sequence[Mapping[str, Any]],
    *,
    source_truncated: bool = False,
) -> tuple[list[_ClassifierMessage], bool]:
    messages: list[_ClassifierMessage] = []
    seen: set[str] = set()
    for row in rows:
        for normalized in normalize_to_messages(row.get(_MESSAGE_FIELD), "user") or []:
            content = normalized["content"]
            if (
                normalized["role"] != "user"
                or not isinstance(content, str)
                or not content
                or content in seen
            ):
                continue
            seen.add(content)
            messages.append({"role": "user", "content": content})

    bounded: list[_ClassifierMessage] = []
    remaining = _MAX_INPUT_CHARS
    truncated = source_truncated
    for classifier_message in reversed(messages):
        if remaining == 0:
            truncated = True
            break
        content = classifier_message["content"]
        if len(content) > remaining:
            content = content[-remaining:]
            truncated = True
        bounded.append({"role": "user", "content": content})
        remaining -= len(content)

    bounded.reverse()
    return bounded, truncated


@traces.trace
def _fetch_conversation_rows(
    project: Project,
    conversation_id: str,
    last_span_timestamp: float,
) -> tuple[list[dict[str, Any]], bool]:
    last_span_time = datetime.fromtimestamp(last_span_timestamp, tz=UTC)

    conversation_filter = build_escaped_term_filter("gen_ai.conversation.id", [conversation_id])
    result = Spans.run_table_query(
        params=SnubaParams(
            start=last_span_time - _CONVERSATION_LOOKBACK,
            end=last_span_time + timedelta(seconds=1),
            projects=[project],
            organization=project.organization,
        ),
        query_string=f"{conversation_filter} has:gen_ai.operation.type has:{_MESSAGE_FIELD}",
        selected_columns=["timestamp", "trace", "client_sample_rate", _MESSAGE_FIELD],
        orderby=["-timestamp"],
        offset=0,
        limit=_MAX_SOURCE_SPANS + 1,
        referrer="telemetry_classifiers.conversation",
        config=SearchResolverConfig(auto_fields=False),
        sampling_mode="HIGHEST_ACCURACY",
    )
    rows = result.get("data", [])
    return list(reversed(rows[:_MAX_SOURCE_SPANS])), len(rows) > _MAX_SOURCE_SPANS


def _source(span: Mapping[str, Any]) -> tuple[str, float]:
    return span["trace"], span.get("client_sample_rate") or 1.0


def _parse_probability(result: Mapping[str, Any]) -> float | None:
    probability = result.get("probability")
    if (
        result.get("type") != "predicate"
        or result.get("name") != "match"
        or isinstance(probability, bool)
        or not isinstance(probability, int | float)
        or not 0 <= probability <= 1
    ):
        return None
    return float(probability)


def _record_outcome(outcome: str) -> None:
    metrics.incr(
        "telemetry_classifiers.conversation.classification",
        tags={"classifier": _CLASSIFIER, "outcome": outcome},
    )


@traces.trace
def _classify_user_frustration(
    project: Project,
    rows: Sequence[Mapping[str, Any]],
    source_truncated: bool,
    conversation_context: _ConversationContext,
) -> None:
    log_context = {**conversation_context, "classifier": _CLASSIFIER}
    messages, input_truncated = _user_messages_from_rows(rows, source_truncated=source_truncated)
    if not messages:
        logger.info(
            "telemetry_classifiers.conversation.skipped",
            extra={**log_context, "reason": "empty_input"},
        )
        _record_outcome("empty_input")
        return

    trace_id, client_sample_rate = _source(rows[-1])

    try:
        result = run_oneshot(
            _ONESHOT_ID,
            {"messages": messages},
            project.organization,
            timeout=20,
        )
    except SeerApiError as error:
        logger.exception(
            "telemetry_classifiers.conversation.failed",
            extra={**log_context, "reason": "seer_request_error", "status": error.status},
        )
        _record_outcome("request_error")
        if error.status == 429 or error.status >= 500:
            raise
        return
    except Exception:
        logger.exception(
            "telemetry_classifiers.conversation.failed",
            extra={**log_context, "reason": "request_error"},
        )
        _record_outcome("request_error")
        raise

    probability = _parse_probability(result)
    if probability is None:
        logger.error(
            "telemetry_classifiers.conversation.failed",
            extra={**log_context, "reason": "invalid_response"},
        )
        _record_outcome("invalid_response")
        return

    produce_enrichment_attributes(
        project,
        idempotency_key="\0".join(
            (
                _CLASSIFIER,
                conversation_context["conversation_id"],
                str(conversation_context["last_span_timestamp"]),
            )
        ),
        trace_id=trace_id,
        timestamp=datetime.fromtimestamp(conversation_context["last_span_timestamp"], tz=UTC),
        retention_days=_POC_RETENTION_DAYS,
        conversation_id=conversation_context["conversation_id"],
        attributes={_POC_USER_FRUSTRATION_ATTRIBUTE: probability},
        client_sample_rate=client_sample_rate,
    )

    logger.info(
        "telemetry_classifiers.conversation.classified",
        extra={
            **log_context,
            "probability": probability,
            "message_count": len(messages),
            "input_truncated": input_truncated,
        },
    )
    _record_outcome("success")


@instrumented_task(
    name="sentry.telemetry_classifiers.poc_tasks.classify_conversation",
    namespace=telemetry_classifiers_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=30, on=(Exception,)),
    silo_mode=SiloMode.CELL,
)
def classify_conversation(
    project_id: int,
    conversation_id: str,
    last_span_timestamp: float,
) -> None:
    """Fetch one conversation once, then run its classifiers."""
    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        _record_outcome("project_missing")
        return

    conversation_context: _ConversationContext = {
        "organization_id": project.organization_id,
        "project_id": project.id,
        "conversation_id": conversation_id,
        "last_span_timestamp": last_span_timestamp,
    }
    with viewer_context_scope(
        ViewerContext(
            actor=Actor(type=ActorType.SYSTEM),
            organization_id=project.organization_id,
            project_id=project.id,
        )
    ):
        try:
            rows, source_truncated = _fetch_conversation_rows(
                project, conversation_id, last_span_timestamp
            )
        except Exception:
            logger.exception(
                "telemetry_classifiers.conversation.failed",
                extra={**conversation_context, "reason": "fetch_error"},
            )
            _record_outcome("request_error")
            raise
        _classify_user_frustration(project, rows, source_truncated, conversation_context)


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
        claimed = _claim_conversations(conversations)
        claimed_count += len(claimed)
        for conversation in claimed:
            classify_conversation.delay(
                project_id=conversation.project_id,
                conversation_id=conversation.conversation_id,
                last_span_timestamp=conversation.last_span_timestamp,
            )

    logger.info(
        "telemetry_classifiers.conversations.fetched",
        extra={
            "fetched_count": fetched_count,
            "claimed_count": claimed_count,
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
        },
    )

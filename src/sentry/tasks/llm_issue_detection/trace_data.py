from __future__ import annotations

import logging
import random
import re
from datetime import UTC, datetime, timedelta

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.agent.utils import normalize_description
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.tasks.llm_issue_detection.detection import TraceMetadataWithSpanCount
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

# Regex to match unescaped quotes (not preceded by backslash)
UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')
LOWER_SPAN_LIMIT = 20
UPPER_SPAN_LIMIT = 500


def get_valid_trace_ids_by_span_count(
    trace_ids: list[str],
    snuba_params: SnubaParams,
    config: SearchResolverConfig,
) -> dict[str, int]:
    """
    Query span counts for all trace_ids in one query.
    Returns a dict mapping trace_id to span count for traces with valid span counts.

    This filters out traces that are too small (lack context) or too large
    (exceed LLM context limits) before sending to Seer for analysis.
    """
    if not trace_ids:
        return {}

    result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:[{','.join(trace_ids)}]",
        selected_columns=["trace", "count()"],
        orderby=None,
        offset=0,
        limit=len(trace_ids),
        referrer=Referrer.ISSUES_LLM_ISSUE_DETECTION_SPAN_COUNT.value,
        config=config,
        sampling_mode="NORMAL",
    )

    return {
        row["trace"]: row["count()"]
        for row in result.get("data", [])
        if LOWER_SPAN_LIMIT <= row["count()"] <= UPPER_SPAN_LIMIT
    }


PROJECT_PLAYLIST_SIZE = 20
PROJECT_PLAYLIST_CACHE_KEY_PREFIX = "llm_detection:project_playlist"
PROJECT_PLAYLIST_CACHE_TTL = 86400 * 7  # 7 days


def get_next_project_id(
    organization: Organization,
    project_ids: list[int],
    start_time_delta_minutes: int = 60,
) -> int | None:
    """
    Pop the next project ID from a cached playlist weighted by traffic.

    The playlist is a shuffled list of project IDs where higher-traffic
    projects appear more often. When the playlist is empty or missing,
    a new one is generated from a Snuba query and cached.

    Returns None if there are no active projects with traffic.
    """
    client = redis_clusters.get("default")
    cache_key = f"{PROJECT_PLAYLIST_CACHE_KEY_PREFIX}:{organization.id}"

    project_id_raw = client.lpop(cache_key)
    if project_id_raw is not None:
        return int(project_id_raw)

    playlist = _build_project_playlist(organization, project_ids, start_time_delta_minutes)
    if not playlist:
        return random.choice(project_ids) if project_ids else None

    if len(playlist) > 1:
        client.rpush(cache_key, *playlist[1:])
        client.expire(cache_key, PROJECT_PLAYLIST_CACHE_TTL)

    return playlist[0]


def _build_project_playlist(
    organization: Organization,
    project_ids: list[int],
    start_time_delta_minutes: int,
) -> list[int]:
    """
    Build a shuffled playlist of PROJECT_PLAYLIST_SIZE project IDs
    weighted by transaction count.
    """
    projects = list(Project.objects.filter(id__in=project_ids))
    if not projects:
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(minutes=start_time_delta_minutes)
    config = SearchResolverConfig(auto_fields=True)

    snuba_params = SnubaParams(
        start=start_time,
        end=end_time,
        projects=projects,
        organization=organization,
    )

    result = Spans.run_table_query(
        params=snuba_params,
        query_string="is_transaction:true",
        selected_columns=["project_id", "count()"],
        orderby=None,
        offset=0,
        limit=len(project_ids),
        referrer=Referrer.ISSUES_LLM_ISSUE_DETECTION_TRANSACTION.value,
        config=config,
        sampling_mode="NORMAL",
    )

    valid_ids = set(project_ids)
    weights = {
        row["project_id"]: row["count()"]
        for row in result.get("data", [])
        if row.get("project_id") in valid_ids
    }

    if not weights:
        return []

    weighted_ids = list(weights.keys())
    weighted_counts = list(weights.values())
    playlist = random.choices(weighted_ids, weights=weighted_counts, k=PROJECT_PLAYLIST_SIZE)
    random.shuffle(playlist)
    return playlist


def get_project_top_transaction_traces_for_llm_detection(
    project_id: int,
    limit: int,
    start_time_delta_minutes: int,
) -> list[TraceMetadataWithSpanCount]:
    """
    Get top transactions by total time spent, return one semi-randomly chosen trace per transaction.
    Filters traces by span count before returning.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception("Project does not exist", extra={"project_id": project_id})
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(minutes=start_time_delta_minutes)
    config = SearchResolverConfig(auto_fields=True)

    def _build_snuba_params(start: datetime) -> SnubaParams:
        """
        Both queries have different start times and the same end time.
        """
        return SnubaParams(
            start=start,
            end=end_time,
            projects=[project],
            organization=project.organization,
        )

    transaction_snuba_params = _build_snuba_params(start_time)

    transactions_result = Spans.run_table_query(
        params=transaction_snuba_params,
        query_string="is_transaction:true",
        selected_columns=[
            "transaction",
            "sum(span.duration)",
        ],
        orderby=["-sum(span.duration)"],
        offset=0,
        limit=limit,
        referrer=Referrer.ISSUES_LLM_ISSUE_DETECTION_TRANSACTION,
        config=config,
        sampling_mode="NORMAL",
    )

    trace_ids: list[str] = []
    seen_names: set[str] = set()
    seen_trace_ids: set[str] = set()
    random_offset = random.randint(1, 8)
    trace_snuba_params = _build_snuba_params(start_time + timedelta(minutes=random_offset))

    for row in transactions_result.get("data", []):
        transaction_name = row.get("transaction")
        if not transaction_name:
            continue

        normalized_name = normalize_description(transaction_name)
        if normalized_name in seen_names:
            continue

        escaped_transaction_name = UNESCAPED_QUOTE_RE.sub('\\"', transaction_name)
        trace_result = Spans.run_table_query(
            params=trace_snuba_params,
            query_string=f'is_transaction:true transaction:"{escaped_transaction_name}"',
            selected_columns=["trace", "precise.start_ts"],
            orderby=["precise.start_ts"],  # First trace in the window
            offset=0,
            limit=1,
            referrer=Referrer.ISSUES_LLM_ISSUE_DETECTION_TRACE,
            config=config,
            sampling_mode="NORMAL",
        )

        data = trace_result.get("data", [])
        if not data:
            continue

        trace_id = data[0].get("trace")
        if not trace_id or trace_id in seen_trace_ids:
            continue

        trace_ids.append(trace_id)
        seen_names.add(normalized_name)
        seen_trace_ids.add(trace_id)

    if not trace_ids:
        return []

    valid_trace_ids = get_valid_trace_ids_by_span_count(trace_ids, transaction_snuba_params, config)

    return [
        TraceMetadataWithSpanCount(
            trace_id=trace_id,
            span_count=valid_trace_ids[trace_id],
        )
        for trace_id in trace_ids
        if trace_id in valid_trace_ids
    ]

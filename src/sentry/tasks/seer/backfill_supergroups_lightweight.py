import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from snuba_sdk import Column, Condition, Direction, Entity, Limit, Op, OrderBy, Query, Request

from sentry import features, options
from sentry.api.serializers import EventSerializer, serialize
from sentry.event_manager import SECURITY_REPORT_INTERFACES
from sentry.eventstore import backend as eventstore
from sentry.models.group import DEFAULT_TYPE_ID, Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.signed_seer_api import (
    LightweightRCAClusterRequest,
    SeerViewerContext,
    make_lightweight_rca_cluster_request,
)
from sentry.seer.similarity.utils import (
    SEER_INELIGIBLE_EVENT_PLATFORMS,
    event_content_has_stacktrace,
)
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.types.group import UNRESOLVED_SUBSTATUS_CHOICES
from sentry.utils import metrics
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.snuba import SnubaError, bulk_snuba_queries

logger = logging.getLogger(__name__)

SNUBA_QUERY_MAX_ATTEMPTS = 3
MAX_GROUP_AGE_DAYS = 90


@instrumented_task(
    name="sentry.tasks.seer.backfill_supergroups_lightweight.backfill_supergroups_lightweight_for_org",
    namespace=seer_tasks,
    processing_deadline_duration=15 * 60,
)
def backfill_supergroups_lightweight_for_org(
    organization_id: int,
    last_project_id: int = 0,
    last_group_id: int = 0,
    **kwargs,
) -> None:
    if options.get("seer.supergroups_backfill_lightweight.killswitch"):
        logger.info("supergroups_backfill_lightweight.killswitch_enabled")
        return

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        return

    if not features.has("organizations:supergroups-lightweight-rca-clustering-write", organization):
        logger.info(
            "supergroups_backfill_lightweight.feature_not_enabled",
            extra={"organization_id": organization_id},
        )
        return

    try:
        _backfill_org(organization, organization_id, last_project_id, last_group_id)
    except Exception:
        logger.exception(
            "supergroups_backfill_lightweight.task_failed",
            extra={
                "organization_id": organization_id,
                "last_project_id": last_project_id,
                "last_group_id": last_group_id,
            },
        )
        raise


def _backfill_org(
    organization: Organization,
    organization_id: int,
    last_project_id: int,
    last_group_id: int,
) -> None:
    batch_size: int = options.get("seer.supergroups_backfill_lightweight.batch_size")
    inter_batch_delay_s: int = options.get(
        "seer.supergroups_backfill_lightweight.inter_batch_delay_s"
    )
    max_failures_per_batch: int = options.get(
        "seer.supergroups_backfill_lightweight.max_failures_per_batch"
    )

    if batch_size <= 0:
        logger.error(
            "supergroups_backfill_lightweight.invalid_batch_size",
            extra={"organization_id": organization_id, "batch_size": batch_size},
        )
        return

    # Get the next project to process, starting from where we left off
    project = (
        Project.objects.filter(
            organization_id=organization_id,
            id__gte=last_project_id or 0,
        )
        .order_by("id")
        .first()
    )

    if not project:
        logger.info(
            "supergroups_backfill_lightweight.org_completed",
            extra={"organization_id": organization_id},
        )
        return

    # If we moved to a new project, reset the group cursor
    if project.id != last_project_id:
        last_group_id = 0

    groups = list(
        Group.objects.filter(
            project_id=project.id,
            type=DEFAULT_TYPE_ID,
            id__gt=last_group_id,
            status=GroupStatus.UNRESOLVED,
            substatus__in=UNRESOLVED_SUBSTATUS_CHOICES,
            last_seen__gte=datetime.now(UTC) - timedelta(days=MAX_GROUP_AGE_DAYS),
        )
        .select_related("project", "project__organization")
        .order_by("id")[:batch_size]
    )

    if not groups:
        # Current project exhausted, move to the next one
        backfill_supergroups_lightweight_for_org.apply_async(
            args=[organization_id],
            kwargs={
                "last_project_id": project.id + 1,
                "last_group_id": 0,
            },
            countdown=inter_batch_delay_s,
            headers={"sentry-propagate-traces": False},
        )
        return

    logger.info(
        "supergroups_backfill_lightweight.batch_starting",
        extra={
            "organization_id": organization_id,
            "project_id": project.id,
            "last_group_id": last_group_id,
            "batch_size": len(groups),
            "first_group_id": groups[0].id,
            "last_group_id_in_batch": groups[-1].id,
        },
    )

    # Phase 1: Batch fetch event data
    group_event_pairs = _batch_fetch_events(groups, organization_id)

    # Phase 2: Send to Seer (per-group for now, bulk-ready)
    failure_count = 0
    success_count = 0
    last_processed_group_id = last_group_id
    viewer_context = SeerViewerContext(organization_id=organization_id)

    for group, serialized_event in group_event_pairs:
        try:
            body = LightweightRCAClusterRequest(
                group_id=group.id,
                issue={
                    "id": group.id,
                    "title": group.title,
                    "short_id": group.qualified_short_id,
                    "events": [serialized_event],
                },
                organization_slug=organization.slug,
                organization_id=organization_id,
                project_id=group.project_id,
            )
            response = make_lightweight_rca_cluster_request(
                body, timeout=30, viewer_context=viewer_context
            )
            if response.status >= 400:
                logger.warning(
                    "supergroups_backfill_lightweight.seer_error",
                    extra={
                        "group_id": group.id,
                        "project_id": group.project_id,
                        "status": response.status,
                    },
                )
                failure_count += 1
            else:
                success_count += 1
        except Exception:
            logger.exception(
                "supergroups_backfill_lightweight.group_failed",
                extra={"group_id": group.id, "project_id": group.project_id},
            )
            failure_count += 1

        last_processed_group_id = group.id

        if max_failures_per_batch > 0 and failure_count >= max_failures_per_batch:
            logger.error(
                "supergroups_backfill_lightweight.max_failures_reached",
                extra={
                    "organization_id": organization_id,
                    "project_id": project.id,
                    "failure_count": failure_count,
                    "last_processed_group_id": last_processed_group_id,
                },
            )
            break

    metrics.incr(
        "seer.supergroups_backfill_lightweight.groups_processed",
        amount=success_count,
    )
    metrics.incr(
        "seer.supergroups_backfill_lightweight.groups_failed",
        amount=failure_count,
    )

    logger.info(
        "supergroups_backfill_lightweight.batch_complete",
        extra={
            "organization_id": organization_id,
            "project_id": project.id,
            "success_count": success_count,
            "failure_count": failure_count,
            "last_group_id_in_batch": groups[-1].id,
        },
    )

    if max_failures_per_batch > 0 and failure_count >= max_failures_per_batch:
        return

    # Self-chain: more groups in this project, or move to next project
    if len(groups) == batch_size:
        next_project_id = project.id
        next_group_id = groups[-1].id
    else:
        next_project_id = project.id + 1
        next_group_id = 0

    backfill_supergroups_lightweight_for_org.apply_async(
        args=[organization_id],
        kwargs={
            "last_project_id": next_project_id,
            "last_group_id": next_group_id,
        },
        countdown=inter_batch_delay_s,
        headers={"sentry-propagate-traces": False},
    )


def _batch_fetch_events(groups: Sequence[Group], organization_id: int) -> list[tuple[Group, dict]]:
    """
    Fetch the latest event for each group using batched Snuba queries,
    then serialize each event for sending to Seer.
    """
    now = datetime.now(UTC)

    # Build one Snuba request per group to find the latest event_id
    snuba_requests = []
    for group in groups:
        # Use a tight window around the group's last_seen to minimize Snuba scan range
        group_start = group.last_seen - timedelta(hours=1)
        snuba_requests.append(
            Request(
                dataset=Dataset.Events.value,
                app_id="supergroups_backfill",
                query=Query(
                    match=Entity(Dataset.Events.value),
                    select=[Column("event_id"), Column("group_id"), Column("project_id")],
                    where=[
                        Condition(Column("project_id"), Op.EQ, group.project_id),
                        Condition(Column("group_id"), Op.EQ, group.id),
                        Condition(Column("timestamp"), Op.GTE, group_start),
                        Condition(Column("timestamp"), Op.LT, now + timedelta(minutes=5)),
                    ],
                    orderby=[OrderBy(Column("timestamp"), Direction.DESC)],
                    limit=Limit(1),
                ),
                tenant_ids={"organization_id": organization_id},
            )
        )

    retry_policy = ConditionalRetryPolicy(
        test_function=lambda attempt, exc: attempt < SNUBA_QUERY_MAX_ATTEMPTS
        and isinstance(exc, SnubaError),
        delay_function=exponential_delay(1.0),
    )
    results = retry_policy(
        lambda: bulk_snuba_queries(
            snuba_requests,
            referrer=Referrer.SUPERGROUPS_BACKFILL_LIGHTWEIGHT_GET_LATEST_EVENTS.value,
        )
    )

    # Build unfetched Event objects from Snuba results, keeping groups aligned
    matched_groups: list[Group] = []
    events: list[Event] = []
    for group, result in zip(groups, results):
        rows = result.get("data", [])
        if not rows:
            continue
        matched_groups.append(group)
        events.append(
            Event(project_id=group.project_id, event_id=rows[0]["event_id"], group_id=group.id)
        )

    if not events:
        return []

    # Batch fetch all event data from nodestore in one multi-get
    eventstore.bind_nodes(events)

    # Drop events that Seer can't meaningfully analyze: empty data, security
    # reports (CSP/HPKP/Expect-CT/Expect-Staple/NEL), events without
    # stacktraces, and unsupported platforms.  Aligned with the similar-issues
    # eligibility checks in grouping/ingest/seer.py.
    valid_groups: list[Group] = []
    valid_events: list[Event] = []
    for group, event in zip(matched_groups, events):
        if not event.data:
            metrics.incr(
                "seer.supergroups_backfill_lightweight.event_skipped",
                tags={"reason": "no_data"},
            )
            continue
        if event.get_event_type() in SECURITY_REPORT_INTERFACES:
            metrics.incr(
                "seer.supergroups_backfill_lightweight.event_skipped",
                tags={"reason": "security_report"},
            )
            continue
        if not event_content_has_stacktrace(event):
            metrics.incr(
                "seer.supergroups_backfill_lightweight.event_skipped",
                tags={"reason": "no_stacktrace"},
            )
            continue
        if event.platform in SEER_INELIGIBLE_EVENT_PLATFORMS:
            metrics.incr(
                "seer.supergroups_backfill_lightweight.event_skipped",
                tags={"reason": "unsupported_platform"},
            )
            continue
        valid_groups.append(group)
        valid_events.append(event)

    if not valid_events:
        return []

    # Bulk serialize all events
    serialized_events = serialize(valid_events, None, EventSerializer())

    return [
        (group, serialized_event)
        for group, serialized_event in zip(valid_groups, serialized_events)
        if serialized_event
    ]

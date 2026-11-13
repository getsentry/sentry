from __future__ import annotations

import logging

import sentry_sdk
from urllib3.exceptions import MaxRetryError
from urllib3.exceptions import TimeoutError as Urllib3TimeoutError

from sentry.api.serializers import EventSerializer, serialize
from sentry.eventstore import backend as eventstore
from sentry.models.group import Group
from sentry.seer.models import SeerApiError
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
from sentry.utils import metrics
from sentry.utils.validators import normalize_event_id

logger = logging.getLogger(__name__)

# Seconds. Must stay below the task's processing deadline (default 10s).
LIGHTWEIGHT_RCA_CLUSTER_SEER_TIMEOUT = 5


def trigger_lightweight_rca_cluster(group: Group, event_id: str | None = None) -> None:
    """
    Call Seer's lightweight RCA clustering endpoint for the given group.

    Sends issue event data to Seer, which generates a lightweight root cause analysis
    and clusters the issue into supergroups based on embedding similarity.
    """
    if event_id is None:
        # Fallback for tasks enqueued without an event_id. Prefer passing the
        # event_id from post_process to avoid an unbounded Snuba latest-event query.
        event = group.get_latest_event()
        if not event:
            logger.info(
                "lightweight_rca_cluster.no_event",
                extra={"group_id": group.id},
            )
            return
        event_id = event.event_id
        ready_event = eventstore.get_event_by_id(group.project.id, event_id, group_id=group.id)
    else:
        # post_process already loaded this event from nodestore, so read it from there.
        # get_event_by_id also queries Snuba for event types other than "error", and a
        # slow query can run past the task's processing deadline.
        #
        # Without Snuba we cannot check that the event still belongs to this group. An
        # event that an unmerge moved to another group after the task was queued is sent
        # to Seer under the group the task was queued with.
        ready_event = None
        normalized_event_id = normalize_event_id(event_id)
        if normalized_event_id:
            nodestore_event = Event(
                project_id=group.project_id, event_id=normalized_event_id, group_id=group.id
            )
            # Reading data loads it from nodestore. It is empty when nodestore has no
            # payload for this id.
            if nodestore_event.data:
                # get_event_by_id sets these when it is given a group id. Set them here
                # too so the event type stays on this task's trace.
                event_type = nodestore_event.get_event_type()
                sentry_sdk.set_tag("nodestore.event_type", event_type)
                sentry_sdk.set_attribute("nodestore.event_type", event_type)
                ready_event = nodestore_event

    if not ready_event:
        logger.info(
            "lightweight_rca_cluster.event_not_ready",
            extra={"group_id": group.id, "event_id": event_id},
        )
        return

    if not event_content_has_stacktrace(ready_event):
        logger.info(
            "lightweight_rca_cluster.event_not_eligible",
            extra={
                "group_id": group.id,
                "event_id": ready_event.event_id,
                "reason": "no_stacktrace",
            },
        )
        metrics.incr("seer.lightweight_rca_cluster.skipped", tags={"reason": "no_stacktrace"})
        return

    if ready_event.platform in SEER_INELIGIBLE_EVENT_PLATFORMS:
        logger.info(
            "lightweight_rca_cluster.event_not_eligible",
            extra={
                "group_id": group.id,
                "event_id": ready_event.event_id,
                "reason": "unsupported_platform",
            },
        )
        metrics.incr(
            "seer.lightweight_rca_cluster.skipped", tags={"reason": "unsupported_platform"}
        )
        return

    serialized_event = serialize(ready_event, None, EventSerializer())

    body = LightweightRCAClusterRequest(
        group_id=group.id,
        issue={
            "id": group.id,
            "title": group.title,
            "short_id": group.qualified_short_id,
            "events": [serialized_event],
        },
        organization_slug=group.organization.slug,
        organization_id=group.organization.id,
        project_id=group.project.id,
    )
    viewer_context = SeerViewerContext(organization_id=group.organization.id)

    # The timeout applies to connect and to read separately. urllib3 does not retry
    # a read timeout on POST, but the pool's default Retry(3) retries connect timeouts.
    try:
        response = make_lightweight_rca_cluster_request(
            body, timeout=LIGHTWEIGHT_RCA_CLUSTER_SEER_TIMEOUT, viewer_context=viewer_context
        )
    except (Urllib3TimeoutError, MaxRetryError) as e:
        # Clustering is best effort and the task has no retry. Seer timeouts are
        # expected, so count them and return instead of reporting an error.
        logger.warning(
            "lightweight_rca_cluster.request_error",
            extra={
                "group_id": group.id,
                "project_id": group.project.id,
                "organization_id": group.organization.id,
                "event_id": ready_event.event_id,
                "error": type(e).__name__,
            },
        )
        metrics.incr(
            "seer.lightweight_rca_cluster.request",
            tags={"outcome": "error", "error": type(e).__name__},
        )
        return

    if response.status >= 400:
        metrics.incr(
            "seer.lightweight_rca_cluster.request",
            tags={"outcome": "error", "error": f"http_{response.status // 100}xx"},
        )
        raise SeerApiError("Lightweight RCA cluster request failed", response.status)

    metrics.incr("seer.lightweight_rca_cluster.request", tags={"outcome": "success"})
    logger.info(
        "lightweight_rca_cluster.success",
        extra={
            "group_id": group.id,
            "project_id": group.project.id,
            "organization_id": group.organization.id,
        },
    )

from __future__ import annotations

import logging

from sentry.api.serializers import EventSerializer, serialize
from sentry.eventstore import backend as eventstore
from sentry.models.group import Group
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    LightweightRCAClusterRequest,
    SeerViewerContext,
    make_lightweight_rca_cluster_request,
)

logger = logging.getLogger(__name__)


def trigger_lightweight_rca_cluster(group: Group) -> None:
    """
    Call Seer's lightweight RCA clustering endpoint for the given group.

    Sends issue event data to Seer, which generates a lightweight root cause analysis
    and clusters the issue into supergroups based on embedding similarity.
    """
    event = group.get_latest_event()
    if not event:
        logger.info(
            "lightweight_rca_cluster.no_event",
            extra={"group_id": group.id},
        )
        return

    ready_event = eventstore.get_event_by_id(group.project.id, event.event_id, group_id=group.id)
    if not ready_event:
        logger.info(
            "lightweight_rca_cluster.event_not_ready",
            extra={"group_id": group.id, "event_id": event.event_id},
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

    response = make_lightweight_rca_cluster_request(body, timeout=30, viewer_context=viewer_context)
    if response.status >= 400:
        raise SeerApiError("Lightweight RCA cluster request failed", response.status)

    logger.info(
        "lightweight_rca_cluster.success",
        extra={
            "group_id": group.id,
            "project_id": group.project.id,
            "organization_id": group.organization.id,
        },
    )

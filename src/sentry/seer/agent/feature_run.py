"""Generic entry point for dispatching a Seer feature run via the outbox.

Pairs with feature_delivery.py (the result-handler side). Any feature registered
in Seer's FEATURES registry can start a run through here without reimplementing
the SeerRun mirror + SEER_RUN_CREATE outbox plumbing.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import router, transaction
from django.utils.timezone import now

from sentry.hybridcloud.models.outbox import (
    CellOutbox,
    OutboxDatabaseError,
    OutboxFlushError,
    outbox_context,
)
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import SeerFeatureRunRequest
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def start_feature_run(
    *,
    organization: Organization,
    feature_id: str,
    payload: dict[str, Any],
    viewer_context: SeerViewerContext | None = None,
    user_id: int | None = None,
    flush: bool = True,
) -> SeerRun:
    """Create the SeerRun mirror and enqueue the SEER_RUN_CREATE outbox that
    dispatches a feature run to Seer. The run's uuid is the ref Seer echoes back
    with the result and the key the outbox dedupes redelivery on.

    flush=True (default): drain inline so the run starts immediately and a
    dispatch failure surfaces synchronously (mirror -> FAILED, raises
    SeerApiError, no retry). Use for latency-sensitive / user-facing callers.

    flush=False: leave the row for the async outbox runner to drain and retry.
    Use for background callers (e.g. night shift) that don't block on kickoff.
    """
    try:
        with outbox_context(transaction.atomic(using=router.db_for_write(SeerRun)), flush=flush):
            run = SeerRun.objects.create(
                organization=organization,
                user_id=user_id,
                type=SeerRunType.FEATURE_RUN,
                last_triggered_at=now(),
            )
            body = SeerFeatureRunRequest(
                feature_id=feature_id,
                ref=str(run.uuid),
                payload=payload,
            )
            CellOutbox(
                shard_scope=OutboxScope.SEER_SCOPE,
                shard_identifier=run.id,
                category=OutboxCategory.SEER_RUN_CREATE,
                object_identifier=run.id,
                payload={
                    "body": dict(body),
                    "viewer_context": dict(viewer_context) if viewer_context else None,
                },
            ).save()
    except (OutboxFlushError, OutboxDatabaseError):
        metrics.incr("seer.outbox_flush_error", tags={"type": "feature_run"})
        logger.exception(
            "feature_run.outbox_flush_error",
            extra={
                "organization_id": organization.id,
                "feature_id": feature_id,
                "seer_run_id": run.id,
                "seer_run_uuid": str(run.uuid),
            },
        )
        run.mirror_status = SeerRunMirrorStatus.FAILED
        run.save(update_fields=["mirror_status"])
        raise SeerApiError("Outbox flush failed for feature run SeerRun", 500)

    if not flush:
        return run

    run.refresh_from_db()
    if run.mirror_status != SeerRunMirrorStatus.LIVE or run.seer_run_state_id is None:
        if run.mirror_status == SeerRunMirrorStatus.FAILED:
            detail = "Seer feature run failed during outbox drain"
        elif run.seer_run_state_id is None:
            detail = "Seer feature run did not mirror during outbox drain"
        else:
            detail = f"Seer feature run in unexpected state after outbox drain: {run.mirror_status}"
        raise SeerApiError(detail, 500)
    return run

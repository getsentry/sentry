"""Contextual diagnostics for failed derived computations."""

import logging
from typing import Literal

from sentry.issues.derived.framework import DerivedDataError
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def report_derived_data_error(
    error: DerivedDataError,
    *,
    derived: GroupDerivedData | None,
    operation: Literal[
        "process", "replay", "check", "serialize", "status_check", "reconcile", "assign"
    ],
    pipeline_hash: str | None = None,
    group_id: int | None = None,
) -> None:
    """Call from an exception handler; supply group_id when there is no stored row."""
    if derived is not None:
        group_id = derived.group_id
    logger.exception(
        "issues.derived.feature_error",
        extra={
            "group_id": group_id,
            "cursor_id": derived.cursor_id if derived is not None else None,
            "cursor_date": str(derived.cursor_date) if derived is not None else None,
            "stored_pipeline_hash": derived.pipeline_hash if derived is not None else None,
            "pipeline_hash": pipeline_hash,
            "operation": operation,
            "stage": error.stage,
            "feature_name": error.feature_name,
            "aggregator_name": error.aggregator_name,
            "entry_id": error.entry_id,
        },
    )
    metrics.incr(
        "issues.derived.feature_error",
        sample_rate=1.0,
        tags={
            "operation": operation,
            "stage": error.stage,
            "feature": error.feature_name or "none",
            "aggregator": error.aggregator_name or "none",
        },
    )

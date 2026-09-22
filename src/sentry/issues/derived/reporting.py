"""Contextual diagnostics for failed derived computations."""

import logging

from sentry.issues.derived.framework import DerivedDataError
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def report_derived_data_error(
    error: DerivedDataError,
    *,
    derived: GroupDerivedData,
    operation: str,
    pipeline_hash: str | None = None,
) -> None:
    """Call from an exception handler so the original cause is captured."""
    logger.exception(
        "issues.derived.feature_error",
        extra={
            "group_id": derived.group_id,
            "cursor_id": derived.cursor_id,
            "cursor_date": str(derived.cursor_date),
            "stored_pipeline_hash": derived.pipeline_hash,
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
        tags={"operation": operation, "stage": error.stage},
    )

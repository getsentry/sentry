from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry.utils import metrics
from sentry.workflow_engine.registry import workflow_activity_registry
from sentry.workflow_engine.types import DetectorId
from sentry.workflow_engine.utils import scopedstats

if TYPE_CHECKING:
    from sentry.models.activity import Activity
    from sentry.models.group import Group

logger = logging.getLogger(__name__)

DURATION_METRIC = "workflow_engine.invoke_workflow_activity_handlers.duration"


def invoke_workflow_activity_handlers(
    group: Group,
    activity: Activity,
    detector_id: DetectorId | None = None,
) -> None:
    # TODO - move the workflow_activity_registry to the activity model.
    for handler_key, handler in workflow_activity_registry.registrations.items():
        # Each handler gets its own recorder so we can attribute timing per handler. The
        # recorder always captures the overall wall-clock as `total_recording_duration`;
        # any `@scopedstats.timer()` inside the handler adds a `calls.<fn>.total_dur`
        # breakdown into the same collector automatically.
        recorder = scopedstats.Recorder()
        try:
            with recorder.record():
                handler(group, activity, detector_id)
        except Exception:
            logger.exception(
                "workflow_engine.invoke_workflow_activity_handlers.error",
                extra={
                    "group_id": group.id,
                    "activity_id": activity.id,
                    "handler_name": handler_key,
                    "activity_type": activity.type,
                },
            )
            continue
        finally:
            # Emit the recorded durations as metrics (the backend handles sampling).
            # `.count` keys are always 1 for a single invocation, so they're skipped.
            for stat_key, value in recorder.get_result().items():
                if stat_key.endswith(".count"):
                    continue
                metrics.timing(
                    DURATION_METRIC,
                    value,
                    tags={"handler": handler_key, "stat": stat_key},
                )

from __future__ import annotations

import functools
from typing import assert_never

from sentry.cadence.api import (
    CronSchedule,
    Schedule,
    ScheduledTriggerType,
    clear_schedule,
    cron,
    set_schedule,
)
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowSchedule,
    SeerWorkflowStrategy,
)

# Strategies that run on their config's schedule. Others are triggered by events.
SCHEDULED_STRATEGIES = frozenset({SeerWorkflowStrategy.AGENTIC_TRIAGE_V2})


@functools.cache
def _daily() -> CronSchedule:
    # Matches the legacy night shift's morning run. Firings are spread over the following
    # hour by the trigger type's spread window; see sentry.seer.workflows.scheduled.
    return cron("0 10 * * *")


def schedule_for(config: SeerWorkflowConfig) -> Schedule | None:
    """The schedule `config` should run on, or None if it shouldn't run on a schedule."""
    if not config.enabled or config.strategy not in SCHEDULED_STRATEGIES:
        return None
    schedule = SeerWorkflowSchedule(config.schedule)
    match schedule:
        case SeerWorkflowSchedule.DAILY:
            return _daily()
        case _:
            assert_never(schedule)


def sync_schedule(config: SeerWorkflowConfig) -> None:
    """
    Make the config's cadence schedule match `schedule_for`. Safe to call repeatedly, so
    call it after any change to a config's `enabled` or `schedule`.
    """
    schedule = schedule_for(config)
    if schedule is None:
        clear_schedule(
            organization_id=config.organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_id=config.id,
        )
    else:
        set_schedule(
            organization_id=config.organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_id=config.id,
            schedule=schedule,
        )

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from sentry.cadence.models import ScheduledTriggerType
from sentry.utils.registry import Registry

# A sanity bound: a schedule's spread window is at most half its gap between runs, so
# anything longer would only ever apply to schedules that run less often than daily.
MAX_SPREAD_WINDOW = timedelta(hours=12)


@dataclass(frozen=True)
class TriggerContext:
    """What a trigger action is told about a run it should hand off."""

    organization_id: int
    trigger_type: ScheduledTriggerType
    # Identifies what the trigger is for; its meaning depends on the trigger type.
    target_id: int
    # When the run was scheduled for, not including its offset within the spread window.
    # Stable across duplicate deliveries of the same run, so it can be used to deduplicate.
    scheduled_for: datetime


# A trigger action is called with a batch of due runs, all of the action's trigger type.
#
# Trigger actions exist only to hand runs off: for each run, schedule a task or publish a
# Kafka message, nothing more, ideally in bulk. Actions are called inline by the cadence
# tick, so a slow action delays every trigger. A run is usually delivered once, but may
# occasionally be skipped or delivered twice, so whatever consumes it should tolerate both.
type TriggerAction = Callable[[Sequence[TriggerContext]], None]


@dataclass(frozen=True)
class TriggerTypeRegistration:
    action: TriggerAction
    spread_window: timedelta


trigger_type_registry: Registry[TriggerTypeRegistration] = Registry(enable_reverse_lookup=False)


def register_trigger_action(
    trigger_type: ScheduledTriggerType, *, spread_window: timedelta = timedelta(0)
) -> Callable[[TriggerAction], TriggerAction]:
    """
    Register the action that hands off due runs of `trigger_type`. See `TriggerAction`.

    To distribute load, `spread_window` spreads the type's runs over up to that long after
    their scheduled time: each schedule runs at a fixed offset within it. Zero, the default,
    runs every schedule at its scheduled time. The window isn't always used in full: each
    schedule's window is at most half its shortest gap between runs, so a run always happens
    before its schedule's next scheduled time. With a 1 hour window, a daily schedule spreads
    over the whole hour, but a schedule that runs every 30 minutes only over 15 minutes.

    Changing `spread_window` retunes all of the type's schedules at once, each from its next
    run.
    """
    if not timedelta(0) <= spread_window <= MAX_SPREAD_WINDOW:
        raise ValueError(
            f"spread_window must be between 0 and {MAX_SPREAD_WINDOW}, got {spread_window}"
        )
    if spread_window % timedelta(seconds=1):
        raise ValueError("spread_window must be a whole number of seconds")

    def register(action: TriggerAction) -> TriggerAction:
        trigger_type_registry.register(trigger_type)(
            TriggerTypeRegistration(action=action, spread_window=spread_window)
        )
        return action

    return register

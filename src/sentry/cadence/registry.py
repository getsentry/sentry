from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from sentry.cadence.models import ScheduledTriggerType
from sentry.utils.registry import Registry

# A sanity bound: a trigger's spread window is at most half its gap between scheduled times,
# so anything longer would only ever apply to triggers that fire less often than daily.
MAX_SPREAD_WINDOW = timedelta(hours=12)


@dataclass(frozen=True)
class TriggerFiring:
    """One firing of a trigger, as passed to its trigger type's action to hand off."""

    organization_id: int
    trigger_type: ScheduledTriggerType
    # Identifies what the trigger is for; its meaning depends on the trigger type.
    target_id: int
    # The firing's scheduled time, not including its offset within the spread window.
    # Stable across duplicate deliveries of the same firing, so it can be used to deduplicate.
    scheduled_for: datetime


# A trigger action is called with a batch of firings, all of the action's trigger type.
#
# Trigger actions exist only to hand firings off: for each firing, schedule a task or publish
# a Kafka message, nothing more, ideally in bulk. Actions are called inline by the cadence
# tick, so a slow action delays every trigger. A firing is usually delivered once, but may
# occasionally be skipped or delivered twice, so whatever consumes it should tolerate both.
type TriggerAction = Callable[[Sequence[TriggerFiring]], None]


@dataclass(frozen=True)
class TriggerTypeRegistration:
    action: TriggerAction
    spread_window: timedelta


trigger_type_registry: Registry[TriggerTypeRegistration] = Registry(enable_reverse_lookup=False)


def register_trigger_action(
    trigger_type: ScheduledTriggerType, *, spread_window: timedelta = timedelta(0)
) -> Callable[[TriggerAction], TriggerAction]:
    """
    Register the action that hands off firings of `trigger_type`. See `TriggerAction`.

    To distribute load, `spread_window` spreads the type's firings over up to that long after
    their scheduled time: each trigger fires at a fixed offset within it. Zero, the default,
    fires every trigger at its scheduled time. The window isn't always used in full: each
    trigger's window is at most half its shortest gap between scheduled times, so a trigger
    always fires before its next scheduled time. With a 1 hour window, a daily trigger spreads
    over the whole hour, but a trigger that fires every 30 minutes only over 15 minutes.

    Changing `spread_window` retunes all of the type's triggers at once, each from its next
    firing.
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

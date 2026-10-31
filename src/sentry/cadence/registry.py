from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime

from sentry.cadence.models import ScheduledTriggerType
from sentry.utils.registry import Registry


@dataclass(frozen=True)
class TriggerContext:
    """What a trigger action is told about a run it should hand off."""

    organization_id: int
    trigger_type: ScheduledTriggerType
    # Identifies what the trigger is for; its meaning depends on the trigger type.
    target_id: int
    # When the run was scheduled for. Stable across duplicate deliveries of the same run,
    # so it can be used to deduplicate.
    scheduled_for: datetime


# A trigger action is called with a batch of due runs, all of the action's trigger type.
#
# Trigger actions exist only to hand runs off: for each run, schedule a task or publish a
# Kafka message, nothing more, ideally in bulk. Actions are called inline by the cadence
# tick, so a slow action delays every trigger. A run is usually delivered once, but may
# occasionally be skipped or delivered twice, so whatever consumes it should tolerate both.
type TriggerAction = Callable[[Sequence[TriggerContext]], None]

trigger_action_registry: Registry[TriggerAction] = Registry(enable_reverse_lookup=False)


def register_trigger_action(
    trigger_type: ScheduledTriggerType,
) -> Callable[[TriggerAction], TriggerAction]:
    """Register the action that hands off due runs of `trigger_type`. See `TriggerAction`."""
    return trigger_action_registry.register(trigger_type)

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from sentry.cadence.models import ScheduledTriggerType
from sentry.utils.registry import Registry

# A trigger action is called with the ScheduledTrigger id and the time the run was
# scheduled for.
#
# Trigger actions exist only to schedule tasks: an action should look up what it needs
# and enqueue a task that does the real work, nothing more. Actions run under a short
# processing deadline on a shared worker pool. A run is usually delivered once, but may
# occasionally be skipped or delivered twice, so the scheduled task should tolerate both.
type TriggerAction = Callable[[int, datetime], None]

trigger_action_registry: Registry[TriggerAction] = Registry(enable_reverse_lookup=False)


def register_trigger_action(
    trigger_type: ScheduledTriggerType,
) -> Callable[[TriggerAction], TriggerAction]:
    """Register the action that schedules the task for `trigger_type`."""
    return trigger_action_registry.register(trigger_type)

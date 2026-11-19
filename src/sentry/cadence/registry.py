from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable, Collection, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import ClassVar

from django.db import models, router

from sentry.cadence.models import ScheduledTriggerType
from sentry.utils.registry import Registry

# A sanity bound: a trigger's spread window is at most half its gap between scheduled times,
# so anything longer would only ever apply to triggers that fire less often than daily.
MAX_SPREAD_WINDOW = timedelta(hours=12)


@dataclass(frozen=True)
class TriggerFiring:
    """One firing of a trigger, as passed to its trigger type's `dispatch`."""

    organization_id: int
    trigger_type: ScheduledTriggerType
    # Identifies what the trigger is for; its meaning depends on the trigger type.
    target_id: int
    # The firing's scheduled time, not including its offset within the spread window.
    # Stable across duplicate deliveries of the same firing, so it can be used to deduplicate.
    scheduled_for: datetime
    # Next nominal scheduled time, excluding spreading, as calculated when claimed.
    # Informational: schedule edits or duplicate deliveries may give a different value.
    next_scheduled_for: datetime


@dataclass(frozen=True)
class TriggerTarget:
    """What a trigger is for, as passed to its trigger type's `find_missing`."""

    organization_id: int
    target_id: int


class TriggerHandler(ABC):
    """
    What Cadence needs to know about a trigger type. Subclass it and register the subclass
    with `register_trigger_type`, which instantiates it once, so it must be stateless.

    `spread_window` spreads the type's firings over up to that long after their scheduled
    time, to distribute load: each trigger fires at a fixed offset within it. Zero, the
    default, fires every trigger at its scheduled time. The window isn't always used in full:
    each trigger's window is at most half its shortest gap between scheduled times, so a
    trigger always fires before its next scheduled time. With a 1 hour window, a daily
    trigger spreads over the whole hour, but a trigger that fires every 30 minutes only over
    15 minutes. Changing it retunes all of the type's triggers at once, each from its next
    firing.
    """

    spread_window: ClassVar[timedelta] = timedelta(0)

    @abstractmethod
    def dispatch(self, firings: Sequence[TriggerFiring]) -> None:
        """
        Dispatch a batch of firings, all of this trigger type.

        Do only cheap work here, ideally in bulk: for each firing, schedule a task, publish a
        Kafka message, or just log or count it. Anything slower belongs in the work it
        schedules. It is called inline by the cadence tick, so a slow dispatch delays every
        trigger. A firing is usually delivered once, but may occasionally be skipped or
        delivered twice, so whatever consumes it should tolerate both.
        """

    @abstractmethod
    def find_missing(self, targets: Sequence[TriggerTarget]) -> Collection[TriggerTarget]:
        """
        Return those of `targets` that no longer exist. Cadence may use this to remove their
        triggers, at any time and in batches of any size, or not at all.

        Should be a single cheap query, such as a primary key lookup; see `missing_targets`.
        Read from the primary, since a target reported missing may have its trigger deleted.
        A target that exists but belongs to another organization is missing too. Only report
        targets that are gone: a disabled target should have its schedule cleared instead.
        """


trigger_type_registry: Registry[TriggerHandler] = Registry(enable_reverse_lookup=False)


def register_trigger_type[T: type[TriggerHandler]](
    trigger_type: ScheduledTriggerType,
) -> Callable[[T], T]:
    """
    Register the `TriggerHandler` subclass for `trigger_type`. Raises at registration if
    the subclass doesn't implement every required method, or its settings are invalid.
    """

    def register(cls: T) -> T:
        handler = cls()
        spread_window = handler.spread_window
        if not timedelta(0) <= spread_window <= MAX_SPREAD_WINDOW:
            raise ValueError(
                f"spread_window must be between 0 and {MAX_SPREAD_WINDOW}, got {spread_window}"
            )
        if spread_window % timedelta(seconds=1):
            raise ValueError("spread_window must be a whole number of seconds")
        trigger_type_registry.register(trigger_type)(handler)
        return cls

    return register


def missing_targets(
    model: type[models.Model],
    targets: Sequence[TriggerTarget],
    *,
    org_field: str = "organization_id",
) -> list[TriggerTarget]:
    """
    For `TriggerHandler.find_missing`: those of `targets` with no `model` row whose primary
    key is the target id and whose `org_field` is the organization id. One query, on the
    primary.
    """
    if not targets:
        return []
    existing = set(
        model._default_manager.using(router.db_for_write(model))
        .filter(
            pk__in={target.target_id for target in targets},
            **{f"{org_field}__in": {target.organization_id for target in targets}},
        )
        .values_list(org_field, "pk")
    )
    return [
        target for target in targets if (target.organization_id, target.target_id) not in existing
    ]

Cadence fires triggers on a recurring schedule. A trigger is for a target, an object owned by
some other part of Sentry, and each time it fires Cadence dispatches the firing to code
registered for that kind of trigger. Cadence only decides _when_ a trigger fires; what a
firing means, and the work it leads to, is up to the code it is dispatched to.

Terms used throughout:

- A **trigger** is identified by (organization, trigger type, target id) and has a
  **schedule**. It is stored, and persists until it's cleared.
- A trigger **fires** when its schedule comes due. Each occurrence is a **firing**.
- A trigger type's **handler** dispatches its firings, and reports which targets no longer
  exist.

Import only from `sentry.cadence.api`. Everything else in this package can change freely.

The examples below use `ScheduledTriggerType.EXAMPLE`, a made-up trigger type whose targets
are `ExampleConfig` rows. Neither exists; substitute your own.

## Scheduling

A trigger's target id means whatever its trigger type says; for `EXAMPLE` it would be an
`ExampleConfig` id.

```python
from datetime import timedelta

from sentry.cadence.api import ScheduledTriggerType, clear_schedule, cron, every, set_schedule

set_schedule(
    organization_id=org.id,
    trigger_type=ScheduledTriggerType.EXAMPLE,
    target_id=example_config.id,
    schedule=cron("0 10 * * *", timezone="America/New_York"),  # or every(timedelta(hours=6))
)
clear_schedule(
    organization_id=org.id,
    trigger_type=ScheduledTriggerType.EXAMPLE,
    target_id=example_config.id,
)
```

- `every(interval)` fires every `interval`, which must be between 30 minutes and 1 week.
- `cron(expression, timezone)` fires on a five-field cron expression evaluated in `timezone`.
  Its times must be at least 30 minutes apart in real time, including across daylight saving
  changes. A time that happens twice when clocks go back fires once, at its first occurrence;
  a time skipped when clocks go forward fires when they do (02:30 fires at 03:00).
- Both are validated when constructed, so a `Schedule` is always valid. Invalid input raises
  `InvalidSchedule`.
- `set_schedule` creates a target's trigger or replaces its schedule. Setting the schedule a
  trigger already has changes nothing, so it is safe to call on every change to the target.
  - A new interval schedule first fires one interval from now. A changed one keeps its
    pending firing if that is still ahead and within the new interval.
  - A new or changed cron schedule next fires at its next cron time.
  - With a spread window, a scheduled time that has passed is still pending if its firing
    hasn't happened yet. A change that moves that firing into the past skips it instead.
- `clear_schedule` removes the trigger.
- `get_schedules(organization_id=..., trigger_type=..., target_ids=[...])` returns each
  target's schedule, next scheduled time and next fire time, in one query.

Only keep triggers for targets that actually want them: clear the schedule when the target is
disabled or deleted, rather than leaving it to fire and do nothing.

## Handling firings

Each trigger type has one handler: a `TriggerHandler` subclass, registered with
`register_trigger_type`. Its `dispatch` is called with a batch of that type's firings, and its
`find_missing` reports which of a batch of targets no longer exist:

```python
from collections.abc import Collection, Sequence

from sentry.cadence.api import (
    ScheduledTriggerType,
    TriggerFiring,
    TriggerHandler,
    TriggerTarget,
    missing_targets,
    register_trigger_type,
)


@register_trigger_type(ScheduledTriggerType.EXAMPLE)
class ExampleTriggerHandler(TriggerHandler):
    def dispatch(self, firings: Sequence[TriggerFiring]) -> None:
        for firing in firings:
            process_example.delay(
                organization_id=firing.organization_id,
                example_config_id=firing.target_id,
                scheduled_for=firing.scheduled_for.isoformat(),
            )

    def find_missing(self, targets: Sequence[TriggerTarget]) -> Collection[TriggerTarget]:
        return missing_targets(ExampleConfig, targets)
```

`register_trigger_type` instantiates the class once, so it raises at import if a required
method is missing, and the instance must be stateless.

`dispatch` must only do cheap work, such as scheduling a task, publishing a Kafka message, or
logging. It is called inline by the scheduler, so a slow dispatch delays every trigger.
Register handlers from the owning app's `AppConfig.ready()` so they are loaded in every
process: `set_schedule` raises for a trigger type with no registration, since it needs the
type's spread window.

Firings are delivered best-effort: a firing is usually delivered once, but may occasionally
be skipped (for example, if its dispatch raises) or delivered twice.
`TriggerFiring.scheduled_for` is the firing's scheduled time and is the same for a duplicate,
so use it to deduplicate: for example, `process_example` could skip an
(`example_config_id`, `scheduled_for`) it has already handled.

To add a trigger type, add it to `ScheduledTriggerType` and register its handler. Deploy the
handler before anything creates triggers of the new type: firings of a type with no handler
are lost.

`LOG` is a built-in trigger type for validating scheduling, for example in production,
without touching user data. Its target id can be any id you choose, and it only logs
`cadence.log_trigger.fired` for each firing. See `actions.py`.

### Triggers with missing targets

A target can be deleted without its schedule being cleared. Cadence uses `find_missing` to try
to clean up triggers whose targets are missing, but makes no promise about when, or whether,
it does: keep clearing schedules when targets are deleted, and handle firings for targets
that no longer exist. See `TriggerHandler.find_missing` for its contract.

### Spreading load

When firing at exactly the scheduled time matters less than the load a trigger type creates,
Cadence can spread the type's firings within an acceptable window, set on the handler:

```python
@register_trigger_type(ScheduledTriggerType.EXAMPLE)
class ExampleTriggerHandler(TriggerHandler):
    spread_window = timedelta(hours=1)
```

Each of the type's triggers then fires a fixed offset after its scheduled time, in whole
seconds within the window. A `spread_window` of zero, the default, fires every trigger at its
scheduled time.

The window isn't always used in full. Each trigger's window is at most half its shortest gap
between scheduled times, so a trigger always fires before its next scheduled time, and
firings stay at least half their usual gap apart even when the window changes. With a 1 hour
window, a daily trigger spreads over the whole hour, but a trigger that fires every 30
minutes only spreads over 15 minutes.

- The offset is a stable hash of the trigger's organization, trigger type and target id, so
  a trigger always fires at the same offset after its scheduled time.
- `TriggerFiring.scheduled_for` is still the scheduled time, so deduplicating on it is
  unaffected. `ScheduledTriggerInfo.next_fire_at` is when the trigger next actually fires,
  and `next_scheduled_for` is that firing's scheduled time.
- `spread_window` can be at most 12 hours (`MAX_SPREAD_WINDOW`), half a day.
- Because it's set per trigger type, a code change retunes all of a type's triggers at once.
  The change applies to each trigger from its next firing, so no firing is skipped or
  repeated.

Spreading only affects when triggers fire. Cadence never limits how many firings it
dispatches; handling the load is up to each trigger type's consumer. Windows are set per
trigger type for now. If triggers of one type need different windows, for example because users
choose how exact their own schedules must be, they could move to each trigger.

## Timing

What Cadence promises about when a firing is dispatched, relative to when the firing is
due: its `scheduled_for` plus its offset within its spread window (see "Spreading load").
Without a spread window, that is just `scheduled_for`.

- **Never early.** A firing is never dispatched before it is due, as measured by
  the clock of the worker running the tick. In particular, never before its `scheduled_for`.
- **Normally within 20 seconds.** The target is a p99 `cadence.trigger.dispatch_lag` under 20
  seconds, measured from when the firing is due. The tick runs every 10 seconds, so most
  firings are dispatched up to 10 seconds after they are due, plus the time to claim
  them. Relative to `scheduled_for`, add the offset: normally within the spread window plus
  20 seconds.
- **No upper bound when Cadence is behind.** A firing can be arbitrarily late when:
  - the tick is disabled (`cadence.tick.enabled`) or not running,
  - the tick task is waiting in its taskbroker queue, which it shares with other tasks,
  - more triggers are due than one tick can claim; the rest wait for later ticks.

  A firing that came due while Cadence was behind is still delivered once, when Cadence
  catches up, with its original `scheduled_for`. Firings that would have come due in the
  meantime are skipped, not caught up. If a very late firing should be handled differently,
  compare `scheduled_for` with the current time, allowing for the spread window.

Each `TriggerFiring` also carries `next_scheduled_for`: the next nominal scheduled time,
excluding spreading, calculated when the firing was claimed. Consumers can use it to see
how close the next firing is. It is informational and can change after schedule edits or
between duplicate deliveries; use the original `scheduled_for` to deduplicate.

`cadence.trigger.missed`, tagged by `trigger_type`, counts the intervening firings skipped
when a trigger catches up. Interval counts are exact. Cron counts are capped at 1,000 per
claimed firing to bound counting work after a long outage; a
`cadence.trigger.missed_count_capped` warning indicates that the metric is a lower bound.

These cover only when `dispatch` is called. When the dispatched work happens,
such as when a scheduled task is picked up, depends on the consumer and isn't covered.

## How it works

`ScheduledTrigger` rows store each trigger: its schedule, its next scheduled time
(`next_scheduled_for`) and when that firing is due (`next_fire_at`, the scheduled time plus
the offset). Every 10 seconds the `cadence_tick` task claims rows whose `next_fire_at` has
passed in the last 10 minutes, in batches (`SELECT ... FOR UPDATE SKIP LOCKED`, so
overlapping ticks split the work), moves both times forward, commits, and then calls each
trigger type's `dispatch` with that type's firings. Every minute, `cadence_sweep` does the
same for older rows.

- A trigger that fell behind fires once, late, and then resumes its schedule; firings it
  missed are skipped, not caught up (see "Timing").
- A failing dispatch is logged and counted, and doesn't affect other trigger types.
- A row that can't be scheduled (an unknown trigger type, or a stored schedule that no longer
  parses) is logged and unscheduled, so it can't block other rows.
- Triggers with missing targets are currently cleaned up by the tick, before dispatch, for
  triggers whose schedule was set over an hour ago. `cadence.missing_target_check.enabled`
  turns this off.
- The `cadence.tick.enabled` option is the kill switch, and is **off by default**. While it's
  off, nothing fires.
- Metrics: `cadence.trigger.dispatch_lag` (how late firings are),
  `cadence.trigger.dispatch_duration`, `cadence.trigger.dispatch_failed`,
  `cadence.tick.claimed`, and for missing target checks
  `cadence.trigger.missing_target_deleted`, `cadence.trigger.missing_target_check_duration`
  and `cadence.trigger.missing_target_check_failed`.

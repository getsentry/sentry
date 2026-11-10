Cadence fires triggers on a recurring schedule. A trigger is for a target, an object owned by
some other part of Sentry, and each time it fires Cadence hands the firing off to code
registered for that kind of trigger. Cadence only decides _when_ a trigger fires; what a
firing means, and the work it leads to, is up to wherever the hand-off sends it.

Terms used throughout:

- A **trigger** is identified by (organization, trigger type, target id) and has a
  **schedule**. It is stored, and persists until it's cleared.
- A trigger **fires** when its schedule comes due. Each occurrence is a **firing**.
- A trigger type's **action** is called with its firings, and hands them off.

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

Each trigger type has one action, which is called with a batch of that type's firings:

```python
from collections.abc import Sequence

from sentry.cadence.api import ScheduledTriggerType, TriggerFiring, register_trigger_action


@register_trigger_action(ScheduledTriggerType.EXAMPLE)
def hand_off_example_firings(firings: Sequence[TriggerFiring]) -> None:
    for firing in firings:
        process_example.delay(
            organization_id=firing.organization_id,
            example_config_id=firing.target_id,
            scheduled_for=firing.scheduled_for.isoformat(),
        )
```

Actions must only hand firings off, by scheduling a task or publishing a Kafka message,
nothing more. They are called inline by the scheduler, so a slow action delays every trigger.
Register actions from the owning app's `AppConfig.ready()` so they are loaded in every
process: `set_schedule` raises for a trigger type with no registration, since it needs the
type's spread window.

Firings are delivered best-effort: a firing is usually delivered once, but may occasionally
be skipped (for example, if its action raises) or delivered twice.
`TriggerFiring.scheduled_for` is the firing's scheduled time and is the same for a duplicate,
so use it to deduplicate: for example, `process_example` could skip an
(`example_config_id`, `scheduled_for`) it has already handled.

To add a trigger type, add it to `ScheduledTriggerType` and register its action. Deploy the
action before anything creates triggers of the new type: firings of a type with no action are
lost.

`LOG` is a built-in trigger type for validating scheduling, for example in production,
without touching user data. Its target id can be any id you choose, and its action only logs
`cadence.log_trigger.fired` for each firing. See `actions.py`.

### Spreading load

When firing at exactly the scheduled time matters less than the load a trigger type creates,
Cadence can spread the type's firings within an acceptable window, set when registering:

```python
@register_trigger_action(ScheduledTriggerType.EXAMPLE, spread_window=timedelta(hours=1))
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

Spreading only affects when triggers fire. Cadence never limits how many firings it hands
off; handling the load is up to each trigger type's consumer. Windows are set per trigger
type for now. If triggers of one type need different windows, for example because users
choose how exact their own schedules must be, they could move to each trigger.

## Timing

What Cadence promises about when a firing's action is called, relative to when the firing is
due: its `scheduled_for` plus its offset within its spread window (see "Spreading load").
Without a spread window, that is just `scheduled_for`.

- **Never early.** An action is never called for a firing before it is due, as measured by
  the clock of the worker running the tick. In particular, never before its `scheduled_for`.
- **Normally within 20 seconds.** The target is a p99 `cadence.trigger.dispatch_lag` under 20
  seconds, measured from when the firing is due. The tick runs every 10 seconds, so most
  firings are handed off up to 10 seconds after they are due, plus the time to claim and
  dispatch them. Relative to `scheduled_for`, add the offset: normally within the spread
  window plus 20 seconds.
- **No upper bound when Cadence is behind.** A firing can be arbitrarily late when:
  - the tick is disabled (`cadence.tick.enabled`) or not running,
  - the tick task is waiting in its taskbroker queue, which it shares with other tasks,
  - more triggers are due than one tick can claim; the rest wait for later ticks.

  A firing that came due while Cadence was behind is still delivered once, when Cadence
  catches up, with its original `scheduled_for`. Firings that would have come due in the
  meantime are skipped, not caught up. If a very late firing should be handled differently,
  compare `scheduled_for` with the current time, allowing for the spread window.

These cover only the hand-off, when the action is called. When the handed-off work happens,
such as when a scheduled task is picked up, depends on the consumer and isn't covered.

## How it works

`ScheduledTrigger` rows store each trigger: its schedule, its next scheduled time
(`next_scheduled_for`) and when that firing is due (`next_fire_at`, the scheduled time plus
the offset). Every 10 seconds the `cadence_tick` task claims rows whose `next_fire_at` has
passed, in batches (`SELECT ... FOR UPDATE SKIP LOCKED`, so overlapping ticks split the
work), moves both times forward, commits, and then calls each trigger type's action with
that type's firings.

- A trigger that fell behind fires once, late, and then resumes its schedule; firings it
  missed are skipped, not caught up (see "Timing").
- A failing action is logged and counted, and doesn't affect other trigger types.
- A row that can't be scheduled (an unknown trigger type, or a stored schedule that no longer
  parses) is logged and unscheduled, so it can't block other rows.
- The `cadence.tick.enabled` option is the kill switch, and is **off by default**. While it's
  off, nothing fires.

## Measuring load

Use these signals together to compare throughput, timing, and saturation:

| Metric                               | Meaning                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `cadence.trigger.dispatch_lag`       | Seconds after the stored due time, excluding spreading; tagged by trigger type.                                                          |
| `cadence.trigger.dispatched`         | Number of firings whose action returned successfully; tagged by trigger type. This counts hand-offs, not completed downstream work.      |
| `cadence.trigger.dispatch_failed`    | Number of firings in action batches that raised; a batch may already have handed off some firings before raising.                        |
| `cadence.trigger.dispatch_duration`  | Time spent in an action, per batch and trigger type.                                                                                     |
| `cadence.tick.claim_batch_duration`  | Time spent claiming and advancing one batch.                                                                                             |
| `cadence.tick.duration`              | Total time spent in an enabled tick, including claims and actions.                                                                       |
| `cadence.tick.claimed`               | Distribution of the number of firings claimed per enabled tick.                                                                          |
| `cadence.tick.time_limit_reached`    | Count of ticks that stopped claiming because they exhausted their time budget.                                                           |
| `cadence.backlog.oldest_overdue_age` | Age in seconds of the oldest overdue row, sampled once a minute on the primary using the firing-time index. Zero means none are overdue. |
| `cadence.backlog.query_failed`       | Failed backlog samples, including query timeouts. These leave a gap rather than reporting zero.                                          |

Backlog sampling continues while `cadence.tick.enabled` is off. Its task shares the issues
queue with the tick, so missing samples can also indicate that the worker or queue is behind.

For LOG tests, compare expected hourly volume with distinct
(`organization_id`, `target_id`, `scheduled_for`) tuples in `cadence.log_trigger.fired` logs.
Repeated tuples identify duplicates. Each record includes the stored due time (`fire_at`),
observation time (`fired_at`), and spread-adjusted delay (`seconds_since_due`). The existing
`seconds_since_scheduled` includes spreading. Due-time fields are null for manually
constructed firings that omit `TriggerFiring.fire_at`; Cadence supplies it when claiming.
IDs stay in logs, not metric tags. These measurements cover scheduling and hand-off only.

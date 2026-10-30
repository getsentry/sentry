Cadence runs things on a recurring schedule. A schedule belongs to a target, such as a
`SeerWorkflowConfig`, and when it comes due Cadence hands the run off to code registered for
that kind of target. Cadence only decides _when_ something runs; the work itself happens
wherever the handoff sends it.

Import only from `sentry.cadence.api`. Everything else in this package can change freely.

## Scheduling

A schedule is identified by (organization, trigger type, target id). The target id's meaning
depends on the trigger type:

- `SEER_WORKFLOW`: a `SeerWorkflowConfig` id.
- `LOG`: any id you choose. Its action only logs `cadence.log_trigger.run` for each run, to
  validate scheduling (for example in production) without touching user data.

```python
from datetime import timedelta

from sentry.cadence.api import ScheduledTriggerType, clear_schedule, cron, every, set_schedule

set_schedule(
    organization_id=org.id,
    trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
    target_id=config.id,
    schedule=cron("0 10 * * *", timezone="America/New_York"),  # or every(timedelta(hours=6))
)
clear_schedule(
    organization_id=org.id,
    trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
    target_id=config.id,
)
```

- `every(interval)` runs every `interval`, which must be between 30 minutes and 1 week.
- `cron(expression, timezone)` runs on a five-field cron expression evaluated in `timezone`.
  Runs must be at least 30 minutes apart.
- Both are validated when constructed, so a `Schedule` is always valid. Invalid input raises
  `InvalidSchedule`.
- `set_schedule` creates or replaces a target's schedule. Setting the schedule a target
  already has changes nothing, so it is safe to call on every change to the target.
  - A new interval schedule first runs one interval (plus up to 5 minutes of jitter) from
    now. A changed one keeps its pending run if that is still within the new interval.
  - A new or changed cron schedule next runs at its next cron time.
- `get_schedules(organization_id=..., trigger_type=..., target_ids=[...])` returns each
  target's schedule and next run time, in one query.

Only schedule targets that actually want to run: clear the schedule when the target is
disabled or deleted, rather than leaving it to fire and do nothing.

## Handling runs

Each trigger type has one action, which is called with a batch of that type's due runs:

```python
from collections.abc import Sequence

from sentry.cadence.api import ScheduledTriggerType, TriggerContext, register_trigger_action


@register_trigger_action(ScheduledTriggerType.SEER_WORKFLOW)
def schedule_workflow_runs(runs: Sequence[TriggerContext]) -> None:
    for run in runs:
        run_scheduled_workflow.delay(
            run.organization_id, run.target_id, run.scheduled_for.isoformat()
        )
```

Actions must only hand runs off, by scheduling a task or publishing a Kafka message, nothing
more. They are called inline by the scheduler, so a slow action delays every schedule.
Register actions from the owning app's `AppConfig.ready()` so they are loaded on workers.

Runs are delivered best-effort: a run is usually delivered once, but may occasionally be
skipped (for example, if its action raises) or delivered twice. `TriggerContext.scheduled_for`
is the run's nominal time and is the same for a duplicate, so use it to deduplicate, e.g. as
part of a Seer workflow run's `trigger_key`.

To add a trigger type, add it to `ScheduledTriggerType` and register its action. Deploy the
action before anything creates schedules of the new type: runs of a type with no action are
lost.

## How it works

`ScheduledTrigger` rows store each schedule and its `next_run_at`. Every 10 seconds the
`cadence_tick` task claims due rows in batches (`SELECT ... FOR UPDATE SKIP LOCKED`, so
overlapping ticks split the work), moves each row's `next_run_at` forward, commits, and then
calls each trigger type's action with that type's runs.

- Runs missed while the tick was behind or disabled are skipped, not caught up.
- A failing action is logged and counted, and doesn't affect other trigger types.
- A row that can't be scheduled (an unknown trigger type, or a stored schedule that no longer
  parses) is logged and unscheduled, so it can't block other rows.
- The `cadence.tick.enabled` option is the kill switch, and is **off by default**. While it's
  off, nothing runs.
- Metrics: `cadence.trigger.dispatch_lag` (how late runs are), `cadence.trigger.dispatch_duration`,
  `cadence.trigger.dispatch_failed`, and `cadence.tick.claimed`.

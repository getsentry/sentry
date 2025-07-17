The deletion subsystem manages asynchronous scheduled bulk deletes as well as cascading deletes
into relations. When adding new models to the application, you should consider how those records will
be deleted when a project or organization are deleted.

The deletion subsystem uses records in PostgreSQL to track deletions and their status. This also
allows deletions to be retried when a deploy interrupts a deletion task, or a deletion job fails
because of a new relation or database failure.

## Taskbroker Tasks

Every 15 minutes `sentry.tasks.deletion.run_scheduled_deletions()` runs. This task queries for jobs
that were scheduled to be run in the past that are not already in progress. Tasks are spawned for
each deletion that needs to be processed.

If a task fails, the daily run of `sentry.tasks.deletion.reattempt_deletions()` will
clear the `in_progress` flag of old jobs so that they are picked up by the next scheduled run.

## Scheduling Deletions

The entrypoint into deletions for the majority of application code is via the `ScheduledDeletion`
model. This model lets you create deletion jobs that are run in the future.

```python
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion

ScheduledDeletion.schedule(organization, days=1, hours=2)
```

The above would schedule an organization to be deleted in 1 day and 2 hours.

## Deletion Tasks

The deletion system provides two base classes to cover common scenarios:

- `ModelDeletionTask` fetches records and deletes each instance individually.
  - This strategy is good for models that rely on Django signals or have child relations.
  - This strategy is also the default used when a deletion task isn't specified for a model.
- `BulkModelDeletionTask` deletes records in bulk using a single query.
  - This strategy is well suited to removing records that don't have any relations.

If your model has child relations that need to be cleaned up you should implement a custom
deletion task. Doing so requires a few steps:

1. Add your deletion task subclass to `sentry.deletions.defaults`
2. Add your deletion task to the default manager mapping in `sentry.deletions.__init__`.

## Undoing Deletions

If you have scheduled a record for deletion and want to be able to cancel that deletion, your
deletion task needs to implement the `should_proceed` hook.

```python
def should_proceed(self, instance: ModelT) -> bool:
    return instance.status in {
        ObjectStatus.PENDING_DELETION,
        ObjectStatus.DELETION_IN_PROGRESS
    }
```

The above would only proceed with the deletion if the record's status was correct. When a deletion
is cancelled by this hook, the `ScheduledDeletion` row will be removed.

## Using Deletions Manager Directly

For example, let's say you want to delete an organization:

```python
from sentry import deletions
task = deletions.get(model=Organization, query={})
work = True
while work:
    work = task.chunk()
```

The system has a default task implementation to handle Organization which will efficiently cascade
deletes. This behavior varies based on the input object, as the task can override the behavior for
its children.

For example, when you delete a Group, it will cascade in a more traditional manner. It will batch
each child (such as Event). However, when you delete a project, it won't actually cascade to the
registered Group task. It will instead take a more efficient approach of batch deleting its indirect
descendants, such as Event, so it can more efficiently bulk delete rows.

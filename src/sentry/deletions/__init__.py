"""
The deletions subsystem manages asynchronous scheduled bulk deletes as well as cascading deletes
into relations. When adding new models to the application you should consider how those records will
be deleted when a project or organization are deleted.

The deletion subsystem uses records in postgres to track deletions and their status.  This also
allows deletions to be retried when a deploy interrupts a deletion task, or a deletion job fails
because of a new relation or database failure.

Celery Tasks
------------

Every 15 minutes `sentry.tasks.deletion.run_scheduled_deletion()` runs. This task queries for jobs
that were scheduled to be run in the past that are not already in progress. Tasks are spawned for
each deletion that needs to be processed.

If tasks fail, the daily run of `sentry.tasks.deletion.reattempt_deletions()` will
clear the `in_progress` flag of old jobs so that they are picked up by the next scheduled run.

Scheduling Deletions
--------------------

The entrypoint into deletions for the majority of application code is via the ``ScheduledDeletion``
model. This model lets you creation deletion jobs that are run in the future.

>>> from sentry.models import ScheduledDeletion
>>> ScheduledDeletion.schedule(organization, days=1, hours=2)

The above would schedule an organization to be deleted in 1 day and 2 hours.

Deletion Tasks
--------------

The deletions system provides two base classes to cover common scenarios:

- ``ModelDeletionTask`` fetches records and deletes each instance individually. This strategy is
  good for models that rely on django signals or have child relations. This strategy is also the
  default used when a deletion task isn't specified for a model.
- ``BulkModelDeletionTask`` Deletes records in bulk using a single query. This strategy is well
  suited to removing records that don't have any relations.

If your model has child relations that need to be cleaned up you should implement a custom
deletion task. Doing so requires a few steps:

1. Add your deletion task subclass to `sentry.deletions.defaults`
2. Add your deletion task to the default manager mapping in `sentry.deletions.__init__`.

Undoing Deletions
-----------------

If you have scheduled a record for deletion and want to be able to cancel that deletion, your
deletion task needs to implement the `should_proceed` hook.

>>> def should_proceed(self, instance):
>>>     return instance.status in {ObjectStatus.PENDING_DELETION, ObjectStatus. DELETION_IN_PROGRESS}

The above would only proceed with the deletion if the record's status was correct.  When a deletion
is cancelled by this hook, the `ScheduledDeletion` row will be removed.

Using Deletions Manager Directly
--------------------------------

For example, let's say you want to delete an organization:

>>> from sentry import deletions
>>> task = deletions.get(model=Organization)
>>> work = True
>>> while work:
>>>    work = task.chunk()

The system has a default task implementation to handle Organization which will efficiently cascade
deletes. This behavior varies based on the input object, as the task can override the behavior for
it's children.

For example, when you delete a Group, it will cascade in a more traditional manner. It will batch
each child (such as Event). However, when you delete a project, it won't actually cascade to the
registered Group task. It will instead take a more efficient approach of batch deleting its indirect
descendants, such as Event, so it can more efficiently bulk delete rows.
"""


from .base import BulkModelDeletionTask, ModelDeletionTask, ModelRelation  # NOQA
from .manager import DeletionTaskManager

default_manager = DeletionTaskManager(default_task=ModelDeletionTask)


def load_defaults():
    from sentry import models
    from sentry.discover.models import DiscoverSavedQuery
    from sentry.incidents.models import AlertRule

    from . import defaults

    default_manager.register(AlertRule, defaults.AlertRuleDeletionTask)
    default_manager.register(models.Activity, BulkModelDeletionTask)
    default_manager.register(models.ApiApplication, defaults.ApiApplicationDeletionTask)
    default_manager.register(models.ApiKey, BulkModelDeletionTask)
    default_manager.register(models.ApiGrant, BulkModelDeletionTask)
    default_manager.register(models.ApiToken, BulkModelDeletionTask)
    default_manager.register(models.Commit, defaults.CommitDeletionTask)
    default_manager.register(models.CommitAuthor, defaults.CommitAuthorDeletionTask)
    default_manager.register(models.CommitFileChange, BulkModelDeletionTask)
    default_manager.register(models.Deploy, BulkModelDeletionTask)
    default_manager.register(models.Distribution, BulkModelDeletionTask)
    default_manager.register(DiscoverSavedQuery, defaults.DiscoverSavedQueryDeletionTask)
    default_manager.register(models.EnvironmentProject, BulkModelDeletionTask)
    default_manager.register(models.EventUser, BulkModelDeletionTask)
    default_manager.register(models.Group, defaults.GroupDeletionTask)
    default_manager.register(models.GroupAssignee, BulkModelDeletionTask)
    default_manager.register(models.GroupBookmark, BulkModelDeletionTask)
    default_manager.register(models.GroupCommitResolution, BulkModelDeletionTask)
    default_manager.register(models.GroupEmailThread, BulkModelDeletionTask)
    default_manager.register(models.GroupEnvironment, BulkModelDeletionTask)
    default_manager.register(models.GroupHash, BulkModelDeletionTask)
    default_manager.register(models.GroupHistory, BulkModelDeletionTask)
    default_manager.register(models.GroupLink, BulkModelDeletionTask)
    default_manager.register(models.GroupMeta, BulkModelDeletionTask)
    default_manager.register(models.GroupRedirect, BulkModelDeletionTask)
    default_manager.register(models.GroupRelease, BulkModelDeletionTask)
    default_manager.register(models.GroupResolution, BulkModelDeletionTask)
    default_manager.register(models.GroupRuleStatus, BulkModelDeletionTask)
    default_manager.register(models.GroupSeen, BulkModelDeletionTask)
    default_manager.register(models.GroupShare, BulkModelDeletionTask)
    default_manager.register(models.GroupSnooze, BulkModelDeletionTask)
    default_manager.register(models.GroupSubscription, BulkModelDeletionTask)
    default_manager.register(models.Organization, defaults.OrganizationDeletionTask)
    default_manager.register(
        models.OrganizationIntegration, defaults.OrganizationIntegrationDeletionTask
    )
    default_manager.register(models.OrganizationMemberTeam, BulkModelDeletionTask)
    default_manager.register(models.Project, defaults.ProjectDeletionTask)
    default_manager.register(models.ProjectBookmark, BulkModelDeletionTask)
    default_manager.register(models.ProjectKey, BulkModelDeletionTask)
    default_manager.register(models.PullRequest, BulkModelDeletionTask)
    default_manager.register(models.Release, defaults.ReleaseDeletionTask)
    default_manager.register(models.SavedSearch, BulkModelDeletionTask)
    default_manager.register(models.ReleaseCommit, BulkModelDeletionTask)
    default_manager.register(models.ReleaseEnvironment, BulkModelDeletionTask)
    default_manager.register(models.ReleaseProjectEnvironment, BulkModelDeletionTask)
    default_manager.register(models.ReleaseProject, BulkModelDeletionTask)
    default_manager.register(models.ReleaseHeadCommit, BulkModelDeletionTask)
    default_manager.register(models.Repository, defaults.RepositoryDeletionTask)
    default_manager.register(
        models.RepositoryProjectPathConfig, defaults.RepositoryProjectPathConfigDeletionTask
    )
    default_manager.register(models.SavedSearchUserDefault, BulkModelDeletionTask)
    default_manager.register(models.Team, defaults.TeamDeletionTask)
    default_manager.register(models.UserReport, BulkModelDeletionTask)


load_defaults()

get = default_manager.get
register = default_manager.register

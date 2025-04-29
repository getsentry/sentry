"""
The deletions subsystem manages asynchronous scheduled bulk deletes as well as cascading deletes
into relations. When adding new models to the application you should consider how those records will
be deleted when a project or organization are deleted.

The deletion subsystem uses records in postgres to track deletions and their status.  This also
allows deletions to be retried when a deploy interrupts a deletion task, or a deletion job fails
because of a new relation or database failure.

Celery Tasks
------------

Every 15 minutes `sentry.tasks.deletion.run_scheduled_deletions()` runs. This task queries for jobs
that were scheduled to be run in the past that are not already in progress. Tasks are spawned for
each deletion that needs to be processed.

If tasks fail, the daily run of `sentry.tasks.deletion.reattempt_deletions()` will
clear the `in_progress` flag of old jobs so that they are picked up by the next scheduled run.

Scheduling Deletions
--------------------

The entrypoint into deletions for the majority of application code is via the ``ScheduledDeletion``
model. This model lets you create deletion jobs that are run in the future.

>>> from sentry.models.scheduledeltion import ScheduledDeletion
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
>>>     return instance.status in {ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS}

The above would only proceed with the deletion if the record's status was correct.  When a deletion
is cancelled by this hook, the `ScheduledDeletion` row will be removed.

Using Deletions Manager Directly
--------------------------------

For example, let's say you want to delete an organization:

>>> from sentry import deletions
>>> task = deletions.get(model=Organization, query={})
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

from __future__ import annotations

import functools
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.db.models.base import Model
    from sentry.deletions.base import BaseDeletionTask

from .manager import DeletionTaskManager

# When models are moved, scheduled deletions will fail using the old model's
# fully qualified name and will never be deleted. This mapping maps the old
# names to the new name.
RELOCATED_MODELS: dict[tuple[str, str], tuple[str, str]] = {
    # Example, the Monitor model was moved from the `sentry` app to `monitors`:
    # ("sentry", "Monitor"): ("monitors", "Monitor"),
    #
    # The changes inside of this mapping only need to be temporray to flush out
    # old scheduled deletions, as new scheduled deletions will have the
    # correctly qualified name.
    ("sentry", "Monitor"): ("monitors", "Monitor"),
    ("sentry", "MonitorEnvironment"): ("monitors", "MonitorEnvironment"),
    ("sentry", "MonitorCheckIn"): ("monitors", "MonitorCheckIn"),
    ("sentry", "MonitorIncident"): ("monitors", "MonitorIncident"),
    ("sentry", "MonitorEnvBrokenDetection"): ("monitors", "MonitorEnvBrokenDetection"),
}


def load_defaults(manager: DeletionTaskManager) -> None:
    from sentry import models
    from sentry.discover import models as discover
    from sentry.incidents import models as incidents
    from sentry.integrations import models as integrations
    from sentry.monitors import models as monitors
    from sentry.sentry_apps import models as sentry_apps
    from sentry.snuba import models as snuba
    from sentry.workflow_engine import models as workflow_engine

    from . import defaults
    from .base import BulkModelDeletionTask

    # fmt: off
    manager.register(models.Activity, BulkModelDeletionTask)
    manager.register(models.ApiApplication, defaults.ApiApplicationDeletionTask)
    manager.register(models.ApiGrant, BulkModelDeletionTask)
    manager.register(models.ApiKey, BulkModelDeletionTask)
    manager.register(models.ApiToken, BulkModelDeletionTask)
    manager.register(models.ArtifactBundle, defaults.ArtifactBundleDeletionTask)
    manager.register(models.Commit, defaults.CommitDeletionTask)
    manager.register(models.CommitAuthor, defaults.CommitAuthorDeletionTask)
    manager.register(models.CommitFileChange, BulkModelDeletionTask)
    manager.register(models.Deploy, BulkModelDeletionTask)
    manager.register(models.Distribution, BulkModelDeletionTask)
    manager.register(models.EnvironmentProject, BulkModelDeletionTask)
    manager.register(models.Group, defaults.GroupDeletionTask)
    manager.register(models.GroupAssignee, BulkModelDeletionTask)
    manager.register(models.GroupBookmark, BulkModelDeletionTask)
    manager.register(models.GroupCommitResolution, BulkModelDeletionTask)
    manager.register(models.GroupEmailThread, BulkModelDeletionTask)
    manager.register(models.GroupEnvironment, BulkModelDeletionTask)
    manager.register(models.GroupHash, defaults.GroupHashDeletionTask)
    manager.register(models.GroupHashMetadata, BulkModelDeletionTask)
    manager.register(models.GroupHistory, defaults.GroupHistoryDeletionTask)
    manager.register(models.GroupLink, BulkModelDeletionTask)
    manager.register(models.GroupMeta, BulkModelDeletionTask)
    manager.register(models.GroupRedirect, BulkModelDeletionTask)
    manager.register(models.GroupRelease, BulkModelDeletionTask)
    manager.register(models.GroupResolution, BulkModelDeletionTask)
    manager.register(models.GroupRuleStatus, BulkModelDeletionTask)
    manager.register(models.GroupSeen, BulkModelDeletionTask)
    manager.register(models.GroupShare, BulkModelDeletionTask)
    manager.register(models.GroupSnooze, BulkModelDeletionTask)
    manager.register(models.GroupSubscription, BulkModelDeletionTask)
    manager.register(models.Organization, defaults.OrganizationDeletionTask)
    manager.register(models.OrganizationMember, defaults.OrganizationMemberDeletionTask)
    manager.register(models.OrganizationMemberTeam, BulkModelDeletionTask)
    manager.register(models.Project, defaults.ProjectDeletionTask)
    manager.register(models.ProjectBookmark, BulkModelDeletionTask)
    manager.register(models.ProjectKey, BulkModelDeletionTask)
    manager.register(models.PullRequest, defaults.PullRequestDeletionTask)
    manager.register(models.Release, defaults.ReleaseDeletionTask)
    manager.register(models.ReleaseCommit, BulkModelDeletionTask)
    manager.register(models.ReleaseEnvironment, BulkModelDeletionTask)
    manager.register(models.ReleaseHeadCommit, BulkModelDeletionTask)
    manager.register(models.ReleaseProject, BulkModelDeletionTask)
    manager.register(models.ReleaseProjectEnvironment, BulkModelDeletionTask)
    manager.register(models.Repository, defaults.RepositoryDeletionTask)
    manager.register(models.Rule, defaults.RuleDeletionTask)
    manager.register(models.RuleFireHistory, defaults.RuleFireHistoryDeletionTask)
    manager.register(models.SavedSearch, BulkModelDeletionTask)
    manager.register(models.Team, defaults.TeamDeletionTask)
    manager.register(models.UserReport, BulkModelDeletionTask)

    manager.register(discover.DiscoverSavedQuery, defaults.DiscoverSavedQueryDeletionTask)
    manager.register(discover.DiscoverSavedQueryProject, BulkModelDeletionTask)
    manager.register(incidents.AlertRule, defaults.AlertRuleDeletionTask)
    manager.register(incidents.AlertRuleTrigger, defaults.AlertRuleTriggerDeletionTask)
    manager.register(incidents.AlertRuleTriggerAction, defaults.AlertRuleTriggerActionDeletionTask)
    manager.register(incidents.Incident, defaults.IncidentDeletionTask)
    manager.register(integrations.OrganizationIntegration, defaults.OrganizationIntegrationDeletionTask)
    manager.register(integrations.RepositoryProjectPathConfig, defaults.RepositoryProjectPathConfigDeletionTask)
    manager.register(monitors.Monitor, defaults.MonitorDeletionTask)
    manager.register(monitors.MonitorEnvironment, defaults.MonitorEnvironmentDeletionTask)
    manager.register(sentry_apps.PlatformExternalIssue, defaults.PlatformExternalIssueDeletionTask)
    manager.register(sentry_apps.SentryApp, defaults.SentryAppDeletionTask)
    manager.register(sentry_apps.SentryAppInstallation, defaults.SentryAppInstallationDeletionTask)
    manager.register(sentry_apps.SentryAppInstallationToken, defaults.SentryAppInstallationTokenDeletionTask)
    manager.register(sentry_apps.ServiceHook, defaults.ServiceHookDeletionTask)
    manager.register(snuba.QuerySubscription, defaults.QuerySubscriptionDeletionTask)
    manager.register(workflow_engine.DataSource, defaults.DataSourceDeletionTask)
    manager.register(workflow_engine.Detector, defaults.DetectorDeletionTask)
    manager.register(workflow_engine.Workflow, defaults.WorkflowDeletionTask)
    # fmt: on


@functools.cache
def get_manager() -> DeletionTaskManager:
    """
    Get the deletions default_manager

    The first call to this method will create the manager and register all
    default deletion tasks
    """
    from sentry.deletions.base import ModelDeletionTask

    default_manager = DeletionTaskManager(default_task=ModelDeletionTask)
    load_defaults(default_manager)

    return default_manager


def get(
    task: type[BaseDeletionTask[Any]] | None = None,
    **kwargs: Any,
) -> BaseDeletionTask[Any]:
    """
    Get a deletion task for a given Model class.

    Uses the default_manager from get_manager()
    """
    return get_manager().get(task, **kwargs)


def register(model: type[Model], task: type[BaseDeletionTask[Any]]) -> None:
    """
    Register a deletion task for a given model.

    Uses the default_manager from get_manager()
    """
    return get_manager().register(model, task)


def exec_sync(instance: Model) -> None:
    """
    Execute a deletion task synchronously

    Uses the default_manager from get_manager()
    """
    return get_manager().exec_sync(instance)


def exec_sync_many(instances: list[Model]) -> None:
    """
    Execute a deletion task for multiple records synchronously

    Uses the default_manager from get_manager()
    """
    return get_manager().exec_sync_many(instances)

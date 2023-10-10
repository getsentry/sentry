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


from .base import BulkModelDeletionTask, ModelDeletionTask, ModelRelation  # NOQA
from .defaults.artifactbundle import ArtifactBundleDeletionTask
from .manager import DeletionTaskManager

default_manager = DeletionTaskManager(default_task=ModelDeletionTask)


def load_defaults():
    from sentry.discover.models import DiscoverSavedQuery
    from sentry.incidents.models import AlertRule
    from sentry.models.activity import Activity
    from sentry.models.apiapplication import ApiApplication
    from sentry.models.apigrant import ApiGrant
    from sentry.models.apikey import ApiKey
    from sentry.models.apitoken import ApiToken
    from sentry.models.artifactbundle import ArtifactBundle
    from sentry.models.commit import Commit
    from sentry.models.commitauthor import CommitAuthor
    from sentry.models.commitfilechange import CommitFileChange
    from sentry.models.deploy import Deploy
    from sentry.models.distribution import Distribution
    from sentry.models.environment import EnvironmentProject
    from sentry.models.eventuser import EventUser
    from sentry.models.group import Group
    from sentry.models.groupassignee import GroupAssignee
    from sentry.models.groupbookmark import GroupBookmark
    from sentry.models.groupcommitresolution import GroupCommitResolution
    from sentry.models.groupemailthread import GroupEmailThread
    from sentry.models.groupenvironment import GroupEnvironment
    from sentry.models.grouphash import GroupHash
    from sentry.models.grouphistory import GroupHistory
    from sentry.models.grouplink import GroupLink
    from sentry.models.groupmeta import GroupMeta
    from sentry.models.groupredirect import GroupRedirect
    from sentry.models.grouprelease import GroupRelease
    from sentry.models.groupresolution import GroupResolution
    from sentry.models.grouprulestatus import GroupRuleStatus
    from sentry.models.groupseen import GroupSeen
    from sentry.models.groupshare import GroupShare
    from sentry.models.groupsnooze import GroupSnooze
    from sentry.models.groupsubscription import GroupSubscription
    from sentry.models.integrations.organization_integration import OrganizationIntegration
    from sentry.models.integrations.repository_project_path_config import (
        RepositoryProjectPathConfig,
    )
    from sentry.models.integrations.sentry_app import SentryApp
    from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
    from sentry.models.integrations.sentry_app_installation_token import SentryAppInstallationToken
    from sentry.models.organization import Organization
    from sentry.models.organizationmemberteam import OrganizationMemberTeam
    from sentry.models.platformexternalissue import PlatformExternalIssue
    from sentry.models.project import Project
    from sentry.models.projectbookmark import ProjectBookmark
    from sentry.models.projectkey import ProjectKey
    from sentry.models.pullrequest import PullRequest
    from sentry.models.release import Release, ReleaseProject
    from sentry.models.releasecommit import ReleaseCommit
    from sentry.models.releaseenvironment import ReleaseEnvironment
    from sentry.models.releaseheadcommit import ReleaseHeadCommit
    from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
    from sentry.models.repository import Repository
    from sentry.models.rule import Rule
    from sentry.models.savedsearch import SavedSearch
    from sentry.models.servicehook import ServiceHook
    from sentry.models.team import Team
    from sentry.models.userreport import UserReport
    from sentry.monitors import models as monitor_models

    from . import defaults

    default_manager.register(Activity, BulkModelDeletionTask)
    default_manager.register(AlertRule, defaults.AlertRuleDeletionTask)
    default_manager.register(ApiApplication, defaults.ApiApplicationDeletionTask)
    default_manager.register(ApiGrant, BulkModelDeletionTask)
    default_manager.register(ApiKey, BulkModelDeletionTask)
    default_manager.register(ApiToken, BulkModelDeletionTask)
    default_manager.register(Commit, defaults.CommitDeletionTask)
    default_manager.register(CommitAuthor, defaults.CommitAuthorDeletionTask)
    default_manager.register(CommitFileChange, BulkModelDeletionTask)
    default_manager.register(Deploy, BulkModelDeletionTask)
    default_manager.register(DiscoverSavedQuery, defaults.DiscoverSavedQueryDeletionTask)
    default_manager.register(Distribution, BulkModelDeletionTask)
    default_manager.register(EnvironmentProject, BulkModelDeletionTask)
    default_manager.register(EventUser, BulkModelDeletionTask)
    default_manager.register(Group, defaults.GroupDeletionTask)
    default_manager.register(GroupAssignee, BulkModelDeletionTask)
    default_manager.register(GroupBookmark, BulkModelDeletionTask)
    default_manager.register(GroupCommitResolution, BulkModelDeletionTask)
    default_manager.register(GroupEmailThread, BulkModelDeletionTask)
    default_manager.register(GroupEnvironment, BulkModelDeletionTask)
    default_manager.register(GroupHash, BulkModelDeletionTask)
    default_manager.register(GroupHistory, BulkModelDeletionTask)
    default_manager.register(GroupLink, BulkModelDeletionTask)
    default_manager.register(GroupMeta, BulkModelDeletionTask)
    default_manager.register(GroupRedirect, BulkModelDeletionTask)
    default_manager.register(GroupRelease, BulkModelDeletionTask)
    default_manager.register(GroupResolution, BulkModelDeletionTask)
    default_manager.register(GroupRuleStatus, BulkModelDeletionTask)
    default_manager.register(GroupSeen, BulkModelDeletionTask)
    default_manager.register(GroupShare, BulkModelDeletionTask)
    default_manager.register(GroupSnooze, BulkModelDeletionTask)
    default_manager.register(GroupSubscription, BulkModelDeletionTask)
    default_manager.register(monitor_models.Monitor, defaults.MonitorDeletionTask)
    default_manager.register(
        monitor_models.MonitorEnvironment, defaults.MonitorEnvironmentDeletionTask
    )
    default_manager.register(Organization, defaults.OrganizationDeletionTask)
    default_manager.register(OrganizationIntegration, defaults.OrganizationIntegrationDeletionTask)
    default_manager.register(OrganizationMemberTeam, BulkModelDeletionTask)
    default_manager.register(PlatformExternalIssue, defaults.PlatformExternalIssueDeletionTask)
    default_manager.register(Project, defaults.ProjectDeletionTask)
    default_manager.register(ProjectBookmark, BulkModelDeletionTask)
    default_manager.register(ProjectKey, BulkModelDeletionTask)
    default_manager.register(PullRequest, BulkModelDeletionTask)
    default_manager.register(Release, defaults.ReleaseDeletionTask)
    default_manager.register(ReleaseCommit, BulkModelDeletionTask)
    default_manager.register(ReleaseEnvironment, BulkModelDeletionTask)
    default_manager.register(ReleaseHeadCommit, BulkModelDeletionTask)
    default_manager.register(ReleaseProject, BulkModelDeletionTask)
    default_manager.register(ReleaseProjectEnvironment, BulkModelDeletionTask)
    default_manager.register(Repository, defaults.RepositoryDeletionTask)
    default_manager.register(
        RepositoryProjectPathConfig, defaults.RepositoryProjectPathConfigDeletionTask
    )
    default_manager.register(SentryApp, defaults.SentryAppDeletionTask)
    default_manager.register(SentryAppInstallation, defaults.SentryAppInstallationDeletionTask)
    default_manager.register(
        SentryAppInstallationToken, defaults.SentryAppInstallationTokenDeletionTask
    )
    default_manager.register(ServiceHook, defaults.ServiceHookDeletionTask)
    default_manager.register(SavedSearch, BulkModelDeletionTask)
    default_manager.register(Team, defaults.TeamDeletionTask)
    default_manager.register(UserReport, BulkModelDeletionTask)
    default_manager.register(ArtifactBundle, ArtifactBundleDeletionTask)
    default_manager.register(Rule, defaults.RuleDeletionTask)


load_defaults()

get = default_manager.get
register = default_manager.register
exec_sync = default_manager.exec_sync
exec_sync_many = default_manager.exec_sync_many

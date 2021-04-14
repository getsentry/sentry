"""
The deletions subsystem managers bulk deletes as well as cascades. It attempts
to optimize around various patterns while using a standard approach to do so.

For example, let's say you want to delete an organization:

>>> from sentry import deletions
>>> task = deletions.get(model=Organization)
>>> work = True
>>> while work:
>>>    work = task.chunk()

The system has a default task implementation to handle Organization which will
efficiently cascade deletes. This behavior varies based on the input object,
as the task can override the behavior for it's children.

For example, when you delete a Group, it will cascade in a more traditional
manner. It will batch each child (such as Event). However, when you delete a
project, it won't actually cascade to the registered Group task. It will instead
take a more efficient approach of batch deleting its indirect descendants, such
as Event, so it can more efficiently bulk delete rows.
"""


from .base import BulkModelDeletionTask, ModelDeletionTask, ModelRelation  # NOQA
from .manager import DeletionTaskManager

default_manager = DeletionTaskManager(default_task=ModelDeletionTask)


def load_defaults():
    from sentry import models

    from . import defaults

    default_manager.register(models.Activity, BulkModelDeletionTask)
    default_manager.register(models.ApiApplication, defaults.ApiApplicationDeletionTask)
    default_manager.register(models.ApiKey, BulkModelDeletionTask)
    default_manager.register(models.ApiGrant, BulkModelDeletionTask)
    default_manager.register(models.ApiToken, BulkModelDeletionTask)
    default_manager.register(models.CommitAuthor, BulkModelDeletionTask)
    default_manager.register(models.CommitFileChange, BulkModelDeletionTask)
    default_manager.register(models.EnvironmentProject, BulkModelDeletionTask)
    default_manager.register(models.EventUser, BulkModelDeletionTask)
    default_manager.register(models.Group, defaults.GroupDeletionTask)
    default_manager.register(models.GroupAssignee, BulkModelDeletionTask)
    default_manager.register(models.GroupBookmark, BulkModelDeletionTask)
    default_manager.register(models.GroupCommitResolution, BulkModelDeletionTask)
    default_manager.register(models.GroupEmailThread, BulkModelDeletionTask)
    default_manager.register(models.GroupEnvironment, BulkModelDeletionTask)
    default_manager.register(models.GroupHash, BulkModelDeletionTask)
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
    default_manager.register(models.Repository, defaults.RepositoryDeletionTask)
    default_manager.register(models.SavedSearch, BulkModelDeletionTask)
    default_manager.register(models.SavedSearchUserDefault, BulkModelDeletionTask)
    default_manager.register(models.Team, defaults.TeamDeletionTask)
    default_manager.register(models.UserReport, BulkModelDeletionTask)


load_defaults()

get = default_manager.get
register = default_manager.register

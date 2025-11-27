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
    from sentry.uptime import models as uptime
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
    manager.register(models.File, defaults.FileDeletionTask)
    manager.register(models.FileBlobIndex, BulkModelDeletionTask)
    manager.register(models.Group, defaults.GroupDeletionTask)
    manager.register(models.GroupAssignee, BulkModelDeletionTask)
    manager.register(models.GroupBookmark, BulkModelDeletionTask)
    manager.register(models.GroupCommitResolution, BulkModelDeletionTask)
    manager.register(models.GroupEmailThread, BulkModelDeletionTask)
    manager.register(models.GroupEnvironment, BulkModelDeletionTask)
    manager.register(models.GroupHash, defaults.GroupHashDeletionTask)
    manager.register(models.GroupHashMetadata, BulkModelDeletionTask)
    manager.register(models.GroupHistory, BulkModelDeletionTask)
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
    manager.register(models.ReleaseFile, BulkModelDeletionTask)
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
    manager.register(monitors.MonitorCheckIn, defaults.MonitorCheckInDeletionTask)
    manager.register(monitors.MonitorIncident, defaults.MonitorIncidentDeletionTask)
    manager.register(monitors.MonitorEnvBrokenDetection, BulkModelDeletionTask)
    manager.register(sentry_apps.PlatformExternalIssue, defaults.PlatformExternalIssueDeletionTask)
    manager.register(sentry_apps.SentryApp, defaults.SentryAppDeletionTask)
    manager.register(sentry_apps.SentryAppInstallation, defaults.SentryAppInstallationDeletionTask)
    manager.register(sentry_apps.SentryAppInstallationToken, defaults.SentryAppInstallationTokenDeletionTask)
    manager.register(sentry_apps.ServiceHook, defaults.ServiceHookDeletionTask)
    manager.register(snuba.QuerySubscription, defaults.QuerySubscriptionDeletionTask)
    manager.register(workflow_engine.DataSource, defaults.DataSourceDeletionTask)
    manager.register(workflow_engine.Detector, defaults.DetectorDeletionTask)
    manager.register(workflow_engine.Workflow, defaults.WorkflowDeletionTask)
    manager.register(uptime.UptimeSubscription, defaults.UptimeSubscriptionDeletionTask)
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

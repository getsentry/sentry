from __future__ import annotations

import sentry_sdk
from django.db.models.signals import post_save

from sentry import analytics
from sentry.adoption import manager
from sentry.analytics.events.advanced_search_feature_gated import AdvancedSearchFeatureGateEvent
from sentry.analytics.events.alert_created import AlertCreatedEvent
from sentry.analytics.events.alert_edited import AlertEditedEvent
from sentry.analytics.events.issue_archived import IssueArchivedEvent
from sentry.analytics.events.issue_assigned import IssueAssignedEvent
from sentry.analytics.events.issue_deleted import IssueDeletedEvent
from sentry.analytics.events.issue_escalating import IssueEscalatingEvent
from sentry.analytics.events.issue_ignored import IssueIgnoredEvent
from sentry.analytics.events.issue_mark_reviewed import IssueMarkReviewedEvent
from sentry.analytics.events.issue_priority import IssuePriorityUpdatedEvent
from sentry.analytics.events.issue_resolved import IssueResolvedEvent
from sentry.analytics.events.issue_unignored import IssueUnignoredEvent
from sentry.analytics.events.issue_unresolved import IssueUnresolvedEvent
from sentry.analytics.events.monitor_mark_failed import MonitorEnvironmentMarkFailed
from sentry.analytics.events.organization_joined import OrganizationJoinedEvent
from sentry.analytics.events.plugin_enabled import PluginEnabledEvent
from sentry.analytics.events.repo_linked import RepoLinkedEvent
from sentry.analytics.events.search_saved import SearchSavedEvent
from sentry.analytics.events.sso_enabled import SSOEnabledEvent
from sentry.analytics.events.team_created import TeamCreatedEvent
from sentry.eventstore.models import GroupEvent
from sentry.integrations.analytics import (
    IntegrationAddedEvent,
    IntegrationIssueCreatedEvent,
    IntegrationIssueLinkedEvent,
)
from sentry.integrations.services.integration import integration_service
from sentry.models.featureadoption import FeatureAdoption
from sentry.models.group import Group
from sentry.models.grouptombstone import GroupTombstone
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.plugins.bases.issue import IssueTrackingPlugin
from sentry.plugins.bases.issue2 import IssueTrackingPlugin2
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.signals import (
    advanced_search,
    advanced_search_feature_gated,
    alert_rule_created,
    alert_rule_edited,
    data_scrubber_enabled,
    deploy_created,
    event_processed,
    first_event_received,
    inbound_filter_toggled,
    integration_added,
    integration_issue_created,
    integration_issue_linked,
    issue_archived,
    issue_assigned,
    issue_deleted,
    issue_escalating,
    issue_ignored,
    issue_mark_reviewed,
    issue_resolved,
    issue_unignored,
    issue_unresolved,
    issue_update_priority,
    member_joined,
    monitor_environment_failed,
    ownership_rule_created,
    plugin_enabled,
    project_created,
    release_created,
    repo_linked,
    save_search_created,
    sso_enabled,
    team_created,
    transaction_processed,
    user_feedback_received,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import metrics
from sentry.utils.javascript import has_sourcemap

UNKNOWN_DEFAULT_USER_ID = "unknown"

DEFAULT_TAGS = frozenset(
    [
        "level",
        "logger",
        "transaction",
        "url",
        "browser",
        "sentry:user",
        "os",
        "server_name",
        "device",
        "os.name",
        "browser.name",
        "sentry:release",
        "environment",
        "device.family",
        "site",
        "version",
        "interface_type",
        "rake_task",
        "runtime",
        "runtime.name",
        "type",
        "php_version",
        "app",
        "app.device",
        "locale",
        "os_version",
        "device_model",
        "deviceModel",
        "sentry_version",
    ]
)


# First Event
@first_event_received.connect(weak=False)
def record_first_event(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="first_event", complete=True
    )


def record_event_processed(project, event, **kwargs):
    return record_generic_event_processed(
        project,
        platform=event.group.platform if event.group else event.platform,
        release=event.get_tag("sentry:release"),
        environment=event.get_tag("environment"),
        user_keys=event.data.get("user", {}).keys(),
        tag_keys={tag[0] for tag in event.tags},
        has_sourcemap=has_sourcemap(event),
        has_breadcrumbs=event.data.get("breadcrumbs"),
    )


def record_generic_event_processed(
    project,
    platform=None,
    release=None,
    environment=None,
    user_keys=None,
    tag_keys=None,
    has_sourcemap=False,
    has_breadcrumbs=False,
    **kwargs,
):
    feature_slugs = []

    # Platform
    if platform in manager.location_slugs("language"):
        feature_slugs.append(platform)

    # Release Tracking
    if release:
        feature_slugs.append("release_tracking")

    # Environment Tracking
    if environment:
        feature_slugs.append("environment_tracking")

    # User Tracking
    # We'd like them to tag with id or email.
    # Certain SDKs automatically tag with ip address.
    # Check to make sure more the ip address is being sent.
    # testing for this in test_no_user_tracking_for_ip_address_only
    # list(d.keys()) pattern is to make this python3 safe
    if user_keys and len(set(user_keys) - {"ip_address", "sentry_user"}) > 0:
        feature_slugs.append("user_tracking")

    # Custom Tags
    if tag_keys and set(tag_keys) - DEFAULT_TAGS:
        feature_slugs.append("custom_tags")

    # Sourcemaps
    if has_sourcemap:
        feature_slugs.append("source_maps")

    # Breadcrumbs
    if has_breadcrumbs:
        feature_slugs.append("breadcrumbs")

    if not feature_slugs:
        return

    FeatureAdoption.objects.bulk_record(project.organization_id, feature_slugs)


event_processed.connect(record_event_processed, weak=False)
transaction_processed.connect(record_event_processed, weak=False)


@user_feedback_received.connect(weak=False)
def record_user_feedback(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="user_feedback", complete=True
    )


@project_created.connect(weak=False)
def record_project_created(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="first_project", complete=True
    )


@member_joined.connect(weak=False)
def record_member_joined(organization_id: int, user_id: int, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=organization_id, feature_slug="invite_team", complete=True
    )
    try:
        analytics.record(OrganizationJoinedEvent(user_id=user_id, organization_id=organization_id))
    except Exception as e:
        sentry_sdk.capture_exception(e)


@issue_assigned.connect(weak=False)
def record_issue_assigned(project, group, user, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="assignment", complete=True
    )

    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.default_owner_id or UNKNOWN_DEFAULT_USER_ID
    try:
        analytics.record(
            IssueAssignedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=project.organization_id,
                group_id=group.id,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@issue_resolved.connect(weak=False)
def record_issue_resolved(organization_id, project, group, user, resolution_type, **kwargs):
    """There are three main types of ways to resolve issues
    1) via a release (current release, next release, or other)
    2) via commit (in the UI with the commit hash (marked as "in_commit")
        or tagging the issue in a commit (marked as "with_commit"))
    3) now
    """
    if resolution_type in ("in_next_release", "in_release"):
        FeatureAdoption.objects.record(
            organization_id=organization_id, feature_slug="resolved_in_release", complete=True
        )
    if resolution_type == "with_commit":
        FeatureAdoption.objects.record(
            organization_id=organization_id, feature_slug="resolved_with_commit", complete=True
        )

    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.default_owner_id or UNKNOWN_DEFAULT_USER_ID

    try:
        analytics.record(
            IssueResolvedEvent(
                user_id=user_id,
                project_id=project.id,
                default_user_id=default_user_id,
                organization_id=organization_id,
                group_id=group.id,
                resolution_type=resolution_type,
                issue_type=group.issue_type.slug,
                issue_category=group.issue_category.name.lower(),
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@issue_unresolved.connect(weak=False)
def record_issue_unresolved(project, user, group, transition_type, **kwargs):
    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.default_owner_id or UNKNOWN_DEFAULT_USER_ID

    try:
        analytics.record(
            IssueUnresolvedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=project.organization_id,
                group_id=group.id,
                transition_type=transition_type,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@advanced_search.connect(weak=False)
def record_advanced_search(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="advanced_search", complete=True
    )


@advanced_search_feature_gated.connect(weak=False)
def record_advanced_search_feature_gated(user, organization, **kwargs):
    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = organization.get_default_owner().id

    try:
        analytics.record(
            AdvancedSearchFeatureGateEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=organization.id,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


# XXX(epurkhiser): This was originally used in project saved searches, but
# those no longer exist and this is no longer connected to anything. We
# probably want to connect this up to organization level saved searches.
@save_search_created.connect(weak=False)
def record_save_search_created(project, user, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="saved_search", complete=True
    )

    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    try:
        analytics.record(
            SearchSavedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                project_id=project.id,
                organization_id=project.organization_id,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@inbound_filter_toggled.connect(weak=False)
def record_inbound_filter_toggled(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="inbound_filters", complete=True
    )


@alert_rule_created.connect(weak=False)
def record_alert_rule_created(
    user,
    project: Project,
    rule_id: int,
    rule_type: str,
    is_api_token: bool,
    referrer=None,
    session_id=None,
    alert_rule_ui_component=None,
    duplicate_rule=None,
    wizard_v3=None,
    query_type=None,
    **kwargs,
):
    # NOTE: This intentionally does not fire for the default issue alert rule
    # that gets created on new project creation.
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="alert_rules", complete=True
    )

    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    try:
        analytics.record(
            AlertCreatedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=project.organization_id,
                project_id=project.id,
                rule_id=rule_id,
                rule_type=rule_type,
                is_api_token=is_api_token,
                alert_rule_ui_component=alert_rule_ui_component,
                duplicate_rule=duplicate_rule,
                wizard_v3=wizard_v3,
                query_type=query_type,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@alert_rule_edited.connect(weak=False)
def record_alert_rule_edited(
    user,
    project,
    rule,
    rule_type,
    is_api_token,
    **kwargs,
):
    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    try:
        analytics.record(
            AlertEditedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=project.organization_id,
                rule_id=rule.id,
                rule_type=rule_type,
                is_api_token=is_api_token,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@plugin_enabled.connect(weak=False)
def record_plugin_enabled(plugin, project, user: User | None, **kwargs):
    try:
        analytics.record(
            PluginEnabledEvent(
                user_id=user.id if user else None,
                organization_id=project.organization_id,
                project_id=project.id,
                plugin=plugin.slug,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)

    if isinstance(plugin, (IssueTrackingPlugin, IssueTrackingPlugin2)):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="issue_tracker_integration",
            complete=True,
        )
    elif isinstance(plugin, NotificationPlugin):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="notification_integration",
            complete=True,
        )


@sso_enabled.connect(weak=False)
def record_sso_enabled(organization_id, user_id, provider, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=organization_id, feature_slug="sso", complete=True
    )

    try:
        analytics.record(
            SSOEnabledEvent(user_id=user_id, organization_id=organization_id, provider=provider)
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@data_scrubber_enabled.connect(weak=False)
def record_data_scrubber_enabled(organization, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=organization.id, feature_slug="data_scrubbers", complete=True
    )


def deleted_and_discarded_issue(instance, created, **kwargs):
    if created:
        FeatureAdoption.objects.record(
            organization_id=instance.project.organization_id, feature_slug="delete_and_discard"
        )


@repo_linked.connect(weak=False)
def record_repo_linked(repo, user, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=repo.organization_id, feature_slug="repo_linked", complete=True
    )

    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = Organization.objects.get(id=repo.organization_id).get_default_owner().id

    try:
        analytics.record(
            RepoLinkedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=repo.organization_id,
                repository_id=repo.id,
                provider=repo.provider,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@release_created.connect(weak=False)
def record_release_created(release, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=release.organization_id, feature_slug="release_created", complete=True
    )


@deploy_created.connect(weak=False)
def record_deploy_created(deploy, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=deploy.organization_id, feature_slug="deploy_created", complete=True
    )


@ownership_rule_created.connect(weak=False)
def record_ownership_rule_created(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="ownership_rule_created",
        complete=True,
    )


@issue_ignored.connect(weak=False)
def record_issue_ignored(project, user, group_list, activity_data, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="issue_ignored", complete=True
    )

    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    for group in group_list:
        try:
            analytics.record(
                IssueIgnoredEvent(
                    user_id=user_id,
                    default_user_id=default_user_id,
                    organization_id=project.organization_id,
                    group_id=group.id,
                    ignore_duration=activity_data.get("ignoreDuration"),
                    ignore_count=activity_data.get("ignoreCount"),
                    ignore_window=activity_data.get("ignoreWindow"),
                    ignore_user_count=activity_data.get("ignoreUserCount"),
                    ignore_user_window=activity_data.get("ignoreUserWindow"),
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)


@issue_archived.connect(weak=False)
def record_issue_archived(project, user, group_list, activity_data, **kwargs):
    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    for group in group_list:
        try:
            analytics.record(
                IssueArchivedEvent(
                    user_id=user_id,
                    default_user_id=default_user_id,
                    organization_id=project.organization_id,
                    group_id=group.id,
                    until_escalating=activity_data.get("until_escalating"),
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)


@issue_escalating.connect(weak=False)
def record_issue_escalating(
    project: Project,
    group: Group,
    event: GroupEvent | None,
    was_until_escalating: bool,
    **kwargs,
):
    try:
        analytics.record(
            IssueEscalatingEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                group_id=group.id,
                event_id=event.event_id if event else None,
                was_until_escalating=was_until_escalating,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@issue_update_priority.connect(weak=False)
def record_update_priority(
    project: Project,
    group: Group,
    new_priority: str,
    previous_priority: str | None,
    user_id: int | None,
    reason: str | None,
    **kwargs,
):
    try:
        analytics.record(
            IssuePriorityUpdatedEvent(
                group_id=group.id,
                new_priority=new_priority,
                organization_id=project.organization_id,
                project_id=project.id if project else None,
                user_id=user_id,
                previous_priority=previous_priority,
                issue_category=group.issue_category.name.lower(),
                issue_type=group.issue_type.slug,
                reason=reason,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@issue_unignored.connect(weak=False)
def record_issue_unignored(project, user_id, group, transition_type, **kwargs):
    if user_id is not None:
        default_user_id = user_id
    else:
        default_user_id = project.organization.get_default_owner().id

    try:
        analytics.record(
            IssueUnignoredEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=project.organization_id,
                group_id=group.id,
                transition_type=transition_type,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@issue_mark_reviewed.connect(weak=False)
def record_issue_reviewed(project: Project, user: RpcUser | User | None, group: Group, **kwargs):
    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    try:
        analytics.record(
            IssueMarkReviewedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=project.organization_id,
                group_id=group.id,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@team_created.connect(weak=False)
def record_team_created(
    organization=None,
    user=None,
    team=None,
    organization_id=None,
    user_id=None,
    team_id=None,
    **kwargs,
):
    if organization is None:
        organization = Organization.objects.get(id=organization_id)

    if team_id is None:
        team_id = team.id

    if user_id is None and user and user.is_authenticated:
        user_id = user.id
    if user_id is None:
        default_user_id = organization.get_default_owner().id
    else:
        default_user_id = user_id

    try:
        analytics.record(
            TeamCreatedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=organization.id,
                team_id=team_id,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@integration_added.connect(weak=False)
def record_integration_added(
    integration_id: int, organization_id: int, user_id: int | None, **kwargs
):
    organization = Organization.objects.get(id=organization_id)
    integration = integration_service.get_integration(integration_id=integration_id)
    assert integration, f"integration_added called for missing integration: {integration_id}"

    if user_id is not None:
        default_user_id = user_id
    else:
        default_user_id = organization.get_default_owner().id

    analytics.record(
        IntegrationAddedEvent(
            user_id=user_id,
            default_user_id=default_user_id,
            organization_id=organization.id,
            provider=integration.provider,
            id=integration.id,
        )
    )
    metrics.incr(
        "integration.added",
        sample_rate=1.0,
        tags={"integration_slug": integration.provider},
    )


@integration_issue_created.connect(weak=False)
def record_integration_issue_created(integration, organization, user, **kwargs):
    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = organization.get_default_owner().id
    analytics.record(
        IntegrationIssueCreatedEvent(
            user_id=user_id,
            default_user_id=default_user_id,
            organization_id=organization.id,
            provider=integration.provider,
            id=integration.id,
        )
    )


@integration_issue_linked.connect(weak=False)
def record_integration_issue_linked(integration, organization, user, **kwargs):
    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = organization.get_default_owner().id
    analytics.record(
        IntegrationIssueLinkedEvent(
            user_id=user_id,
            default_user_id=default_user_id,
            organization_id=organization.id,
            provider=integration.provider,
            id=integration.id,
        )
    )


@issue_deleted.connect(weak=False)
def record_issue_deleted(group, user, delete_type, **kwargs):
    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = group.project.organization.get_default_owner().id
    try:
        analytics.record(
            IssueDeletedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=group.project.organization_id,
                group_id=group.id,
                project_id=group.project_id,
                delete_type=delete_type,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@monitor_environment_failed.connect(weak=False)
def record_monitor_failure(monitor_environment, **kwargs):
    try:
        analytics.record(
            MonitorEnvironmentMarkFailed(
                organization_id=monitor_environment.monitor.organization_id,
                monitor_id=str(monitor_environment.monitor.guid),
                project_id=monitor_environment.monitor.project_id,
                environment_id=monitor_environment.environment_id,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


post_save.connect(
    deleted_and_discarded_issue,
    sender=GroupTombstone,
    dispatch_uid="analytics.grouptombstone.created",
    weak=False,
)

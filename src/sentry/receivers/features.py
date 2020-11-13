from __future__ import absolute_import

from django.db.models.signals import post_save

from sentry import analytics
from sentry.adoption import manager
from sentry.models import FeatureAdoption, GroupTombstone, Organization
from sentry.plugins.bases import IssueTrackingPlugin
from sentry.plugins.bases import IssueTrackingPlugin2
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.receivers.rules import DEFAULT_RULE_LABEL, DEFAULT_RULE_DATA
from sentry.signals import (
    advanced_search,
    advanced_search_feature_gated,
    alert_rule_created,
    data_scrubber_enabled,
    deploy_created,
    event_processed,
    first_event_received,
    inbound_filter_toggled,
    integration_added,
    integration_issue_created,
    integration_issue_linked,
    issue_assigned,
    issue_resolved,
    issue_ignored,
    issue_unresolved,
    issue_unignored,
    issue_deleted,
    member_joined,
    ownership_rule_created,
    plugin_enabled,
    project_created,
    release_created,
    repo_linked,
    save_search_created,
    sso_enabled,
    team_created,
    user_feedback_received,
)
from sentry.utils import metrics
from sentry.utils.javascript import has_sourcemap

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


@event_processed.connect(weak=False)
def record_event_processed(project, event, **kwargs):
    feature_slugs = []

    platform = event.group.platform if event.group else event.platform

    # Platform
    if platform in manager.location_slugs("language"):
        feature_slugs.append(platform)

    # Release Tracking
    if event.get_tag("sentry:release"):
        feature_slugs.append("release_tracking")

    # Environment Tracking
    if event.get_tag("environment"):
        feature_slugs.append("environment_tracking")

    # User Tracking
    user_context = event.data.get("user")
    # We'd like them to tag with id or email.
    # Certain SDKs automatically tag with ip address.
    # Check to make sure more the ip address is being sent.
    # testing for this in test_no_user_tracking_for_ip_address_only
    # list(d.keys()) pattern is to make this python3 safe
    if user_context and list(user_context.keys()) != ["ip_address"]:
        feature_slugs.append("user_tracking")

    # Custom Tags
    if set(tag[0] for tag in event.tags) - DEFAULT_TAGS:
        feature_slugs.append("custom_tags")

    # Sourcemaps
    if has_sourcemap(event):
        feature_slugs.append("source_maps")

    # Breadcrumbs
    if event.data.get("breadcrumbs"):
        feature_slugs.append("breadcrumbs")

    if not feature_slugs:
        return

    FeatureAdoption.objects.bulk_record(project.organization_id, feature_slugs)


@user_feedback_received.connect(weak=False)
def record_user_feedback(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="user_feedback", complete=True
    )


@project_created.connect(weak=False)
def record_project_created(project, user, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="first_project", complete=True
    )


@member_joined.connect(weak=False)
def record_member_joined(member, organization, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=member.organization_id, feature_slug="invite_team", complete=True
    )
    analytics.record("organization.joined", user_id=member.user.id, organization_id=organization.id)


@issue_assigned.connect(weak=False)
def record_issue_assigned(project, group, user, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="assignment", complete=True
    )

    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id
    analytics.record(
        "issue.assigned",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=project.organization_id,
        group_id=group.id,
    )


@issue_resolved.connect(weak=False)
def record_issue_resolved(organization_id, project, group, user, resolution_type, **kwargs):
    """ There are three main types of ways to resolve issues
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

    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    analytics.record(
        "issue.resolved",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=organization_id,
        group_id=group.id,
        resolution_type=resolution_type,
    )


@issue_unresolved.connect(weak=False)
def record_issue_unresolved(project, user, group, transition_type, **kwargs):
    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    analytics.record(
        "issue.unresolved",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=project.organization_id,
        group_id=group.id,
        transition_type=transition_type,
    )


@advanced_search.connect(weak=False)
def record_advanced_search(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="advanced_search", complete=True
    )


@advanced_search_feature_gated.connect(weak=False)
def record_advanced_search_feature_gated(user, organization, **kwargs):
    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = organization.get_default_owner().id

    analytics.record(
        "advanced_search.feature_gated",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=organization.id,
    )


@save_search_created.connect(weak=False)
def record_save_search_created(project, user, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="saved_search", complete=True
    )

    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    analytics.record(
        "search.saved",
        user_id=user_id,
        default_user_id=default_user_id,
        project_id=project.id,
        organization_id=project.organization_id,
    )


@inbound_filter_toggled.connect(weak=False)
def record_inbound_filter_toggled(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="inbound_filters", complete=True
    )


@alert_rule_created.connect(weak=False)
def record_alert_rule_created(
    user, project, rule, rule_type, is_api_token, referrer=None, session_id=None, **kwargs
):
    if rule_type == "issue" and rule.label == DEFAULT_RULE_LABEL and rule.data == DEFAULT_RULE_DATA:
        return

    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="alert_rules", complete=True
    )

    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    analytics.record(
        "alert.created",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=project.organization_id,
        project_id=project.id,
        rule_id=rule.id,
        rule_type=rule_type,
        referrer=referrer,
        session_id=session_id,
        is_api_token=is_api_token,
    )


@plugin_enabled.connect(weak=False)
def record_plugin_enabled(plugin, project, user, **kwargs):
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
def record_sso_enabled(organization, user, provider, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=organization.id, feature_slug="sso", complete=True
    )

    analytics.record(
        "sso.enabled", user_id=user.id, organization_id=organization.id, provider=provider
    )


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

    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = Organization.objects.get(id=repo.organization_id).get_default_owner().id

    analytics.record(
        "repo.linked",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=repo.organization_id,
        repository_id=repo.id,
        provider=repo.provider,
    )


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

    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    for group in group_list:
        analytics.record(
            "issue.ignored",
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


@issue_unignored.connect(weak=False)
def record_issue_unignored(project, user, group, transition_type, **kwargs):
    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = project.organization.get_default_owner().id

    analytics.record(
        "issue.unignored",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=project.organization_id,
        group_id=group.id,
        transition_type=transition_type,
    )


@team_created.connect(weak=False)
def record_team_created(organization, user, team, **kwargs):
    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = organization.get_default_owner().id

    analytics.record(
        "team.created",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=organization.id,
        team_id=team.id,
    )


@integration_added.connect(weak=False)
def record_integration_added(integration, organization, user, **kwargs):
    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = organization.get_default_owner().id
    analytics.record(
        "integration.added",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=organization.id,
        provider=integration.provider,
        id=integration.id,
    )
    metrics.incr(
        "integration.added", sample_rate=1.0, tags={"integration_slug": integration.provider},
    )


@integration_issue_created.connect(weak=False)
def record_integration_issue_created(integration, organization, user, **kwargs):
    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = organization.get_default_owner().id
    analytics.record(
        "integration.issue.created",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=organization.id,
        provider=integration.provider,
        id=integration.id,
    )


@integration_issue_linked.connect(weak=False)
def record_integration_issue_linked(integration, organization, user, **kwargs):
    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = organization.get_default_owner().id
    analytics.record(
        "integration.issue.linked",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=organization.id,
        provider=integration.provider,
        id=integration.id,
    )


@issue_deleted.connect(weak=False)
def record_issue_deleted(group, user, delete_type, **kwargs):
    if user and user.is_authenticated():
        user_id = default_user_id = user.id
    else:
        user_id = None
        default_user_id = group.project.organization.get_default_owner().id
    analytics.record(
        "issue.deleted",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=group.project.organization_id,
        group_id=group.id,
        delete_type=delete_type,
    )


post_save.connect(
    deleted_and_discarded_issue,
    sender=GroupTombstone,
    dispatch_uid="analytics.grouptombstone.created",
    weak=False,
)

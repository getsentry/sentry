from __future__ import absolute_import

from django.db.models.signals import post_save

from sentry.adoption import manager
from sentry.models import FeatureAdoption, GroupTombstone
from sentry.plugins import IssueTrackingPlugin, IssueTrackingPlugin2
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.receivers.rules import DEFAULT_RULE_LABEL, DEFAULT_RULE_DATA
from sentry.signals import (
    alert_rule_created,
    event_processed,
    first_event_received,
    project_created,
    member_joined,
    plugin_enabled,
    user_feedback_received,
    issue_assigned,
    issue_resolved_in_release,
    advanced_search,
    save_search_created,
    inbound_filter_toggled,
    sso_enabled,
    data_scrubber_enabled,
)
from sentry.utils.javascript import has_sourcemap

DEFAULT_TAGS = frozenset(
    [
        'level', 'logger', 'transaction', 'url', 'browser', 'sentry:user', 'os', 'server_name',
        'device', 'os.name', 'browser.name', 'sentry:release', 'environment', 'device.family',
        'site', 'version', 'interface_type', 'rake_task', 'runtime', 'runtime.name', 'type',
        'php_version', 'app', 'app.device', 'locale', 'os_version', 'device_model', 'deviceModel',
        'sentry_version'
    ]
)


# First Event
@first_event_received.connect(weak=False)
def record_first_event(project, group, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="first_event", complete=True
    )


@event_processed.connect(weak=False)
def record_event_processed(project, group, event, **kwargs):
    feature_slugs = []

    # Platform
    if group.platform in manager.location_slugs('language'):
        feature_slugs.append(group.platform)

    # Release Tracking
    if event.get_tag('sentry:release'):
        feature_slugs.append('release_tracking')

    # Environment Tracking
    if event.get_tag('environment'):
        feature_slugs.append('environment_tracking')

    # User Tracking
    user_context = event.data.get('sentry.interfaces.User')
    # We'd like them to tag with id or email.
    # Certain SDKs automatically tag with ip address.
    # Check to make sure more the ip address is being sent.
    # testing for this in test_no_user_tracking_for_ip_address_only
    # list(d.keys()) pattern is to make this python3 safe
    if user_context and list(user_context.keys()) != ['ip_address']:
        feature_slugs.append('user_tracking')

    # Custom Tags
    if set(tag[0] for tag in event.tags) - DEFAULT_TAGS:
        feature_slugs.append('custom_tags')

    # Sourcemaps
    if has_sourcemap(event):
        feature_slugs.append('source_maps')

    # Breadcrumbs
    if event.data.get('sentry.interfaces.Breadcrumbs'):
        feature_slugs.append('breadcrumbs')

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
def record_member_joined(member, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=member.organization_id, feature_slug="invite_team", complete=True
    )


@issue_assigned.connect(weak=False)
def record_issue_assigned(project, group, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="assignment", complete=True
    )


@issue_resolved_in_release.connect(weak=False)
def record_issue_resolved_in_release(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="resolved_in_release", complete=True
    )


@advanced_search.connect(weak=False)
def record_advanced_search(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="advanced_search", complete=True
    )


@save_search_created.connect(weak=False)
def record_save_search_created(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="saved_search", complete=True
    )


@inbound_filter_toggled.connect(weak=False)
def record_inbound_filter_toggled(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="inbound_filters", complete=True
    )


@alert_rule_created.connect(weak=False)
def record_alert_rule_created(project, rule, **kwargs):
    if rule.label == DEFAULT_RULE_LABEL and rule.data == DEFAULT_RULE_DATA:
        return

    FeatureAdoption.objects.record(
        organization_id=project.organization_id, feature_slug="alert_rules", complete=True
    )


@plugin_enabled.connect(weak=False)
def record_plugin_enabled(plugin, project, user, **kwargs):
    if isinstance(plugin, (IssueTrackingPlugin, IssueTrackingPlugin2)):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="issue_tracker_integration",
            complete=True
        )
    elif isinstance(plugin, NotificationPlugin):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="notification_integration",
            complete=True
        )


@sso_enabled.connect(weak=False)
def record_sso_enabled(organization, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=organization.id, feature_slug="sso", complete=True
    )


@data_scrubber_enabled.connect(weak=False)
def record_data_scrubber_enabled(organization, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=organization.id, feature_slug="data_scrubbers", complete=True
    )


def deleted_and_discarded_issue(instance, created, **kwargs):
    if created:
        FeatureAdoption.objects.record(
            organization_id=instance.project.organization_id,
            feature_slug="delete_and_discard"
        )


post_save.connect(
    deleted_and_discarded_issue,
    sender=GroupTombstone,
    dispatch_uid='analytics.grouptombstone.created',
    weak=False,
)

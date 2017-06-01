from __future__ import absolute_import

from sentry.adoption import manager
from sentry.interfaces.base import get_interface
from sentry.models import FeatureAdoption
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
    api_called,
    issue_assigned,
    issue_resolved_in_release,
    advanced_search,
    save_search_created,
    inbound_filter_toggled,
    sso_enabled,
    data_scrubber_enabled,
)
from sentry.utils.javascript import has_sourcemap


# First Event
@first_event_received.connect(weak=False)
def record_first_event(project, group, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="first_event",
        complete=True)


@event_processed.connect(weak=False)
def record_event_processed(project, group, event, **kwargs):
    # Platform
    if group.platform in manager.location_slugs('language'):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug=group.platform,
            complete=True)

        # Frameworks
        if event.data.get('sdk'):
            if len(event.data.get('sdk').get('name').split(':')) == 2:
                framework = event.data.get('sdk').get('name').split(':')[1]

                if framework in manager.integration_slugs(group.platform):
                    FeatureAdoption.objects.record(
                        organization_id=project.organization_id,
                        feature_slug=framework,
                        complete=True)

    elif event.data.get(get_interface('csp')):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="csp",
            complete=True)

    # First Event
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="first_event",
        complete=True)

    # Release Tracking
    if event.get_tag('sentry:release'):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="release_tracking",
            complete=True)

    # Environment Tracking
    if event.get_tag('environment'):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="environment_tracking",
            complete=True)

    # User Tracking
    if event.data.get('sentry.interfaces.User'):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="user_tracking",
            complete=True)

    # Custom Tags
    default_tags = set(['sentry_version', 'environment', 'level', 'logger',
        'browser', 'browser.name', 'device', 'os', 'os.name', 'device', 'device.name',
        'app.device', 'url', 'server_name', 'react'])
    if set(tag[0] for tag in event.tags) - default_tags:
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="custom_tags",
            complete=True)

    # Sourcemaps
    if has_sourcemap(event):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="source_maps",
            complete=True)

    # Breadcrumbs
    if event.data.get(get_interface('breadcrumbs')):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="breadcrumbs",
            complete=True)


@user_feedback_received.connect(weak=False)
def record_user_feedback(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="user_feedback",
        complete=True)


@api_called.connect(weak=False)
def record_api_called(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="api",
        complete=True)


@project_created.connect(weak=False)
def record_project_created(project, user, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="first_project",
        complete=True)


@member_joined.connect(weak=False)
def record_member_joined(member, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=member.organization_id,
        feature_slug="invite_team",
        complete=True)


@issue_assigned.connect(weak=False)
def record_issue_assigned(project, group, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="assignment",
        complete=True)


@issue_resolved_in_release.connect(weak=False)
def record_issue_resolved_in_release(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="resolved_in_release",
        complete=True)


@advanced_search.connect(weak=False)
def record_advanced_search(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="advanced_search",
        complete=True)


@save_search_created.connect(weak=False)
def record_save_search_created(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="saved_search",
        complete=True)


@inbound_filter_toggled.connect(weak=False)
def record_inbound_filter_toggled(project, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="inbound_filters",
        complete=True)


@alert_rule_created.connect(weak=False)
def record_alert_rule_created(project, rule, **kwargs):
    if rule.label == DEFAULT_RULE_LABEL or rule.data == DEFAULT_RULE_DATA:
        return

    FeatureAdoption.objects.record(
        organization_id=project.organization_id,
        feature_slug="alert_rules",
        complete=True)


@plugin_enabled.connect(weak=False)
def record_plugin_enabled(plugin, project, user, **kwargs):
    if isinstance(plugin, (IssueTrackingPlugin, IssueTrackingPlugin2)):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="issue_tracker_integration",
            complete=True)
    elif isinstance(plugin, NotificationPlugin):
        FeatureAdoption.objects.record(
            organization_id=project.organization_id,
            feature_slug="notification_integration",
            complete=True)


@sso_enabled.connect(weak=False)
def record_sso_enabled(organization, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=organization.id,
        feature_slug="sso",
        complete=True)


@data_scrubber_enabled.connect(weak=False)
def record_data_scrubber_enabled(organization, **kwargs):
    FeatureAdoption.objects.record(
        organization_id=organization.id,
        feature_slug="data_scrubbers",
        complete=True)

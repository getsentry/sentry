from __future__ import absolute_import

from django.utils import timezone

from sentry.models import FeatureAdoption, Rule
from sentry.plugins import IssueTrackingPlugin2, NotificationPlugin
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
from sentry.receivers.rules import DEFAULT_RULE_DATA
from sentry.testutils import TestCase


class FeatureAdoptionTest(TestCase):
    def setUp(self):
        super(FeatureAdoptionTest, self).setUp()
        self.now = timezone.now().replace(microsecond=0)
        self.owner = self.create_user()
        self.organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(team=self.team)

    def test_bad_feature_slug(self):
        FeatureAdoption.objects.record(self.organization.id, "xxx")

    def test_first_event(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        first_event_received.send(project=self.project, group=group, sender=type(self.project))

        first_event = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="first_event")
        assert first_event.complete

    def test_javascript(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        js = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="javascript")
        assert js.complete

    def test_python(self):
        group = self.create_group(project=self.project, platform='python', message='python error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        python = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="python")
        assert python.complete

    def test_node(self):
        group = self.create_group(project=self.project, platform='node', message='node error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        node = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="node")
        assert node.complete

    def test_ruby(self):
        group = self.create_group(project=self.project, platform='ruby', message='ruby error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        ruby = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="ruby")
        assert ruby.complete

    def test_java(self):
        group = self.create_group(project=self.project, platform='java', message='java error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        java = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="java")
        assert java.complete

    def test_cocoa(self):
        group = self.create_group(project=self.project, platform='cocoa', message='cocoa error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        cocoa = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="cocoa")
        assert cocoa.complete

    def test_objc(self):
        group = self.create_group(project=self.project, platform='objc', message='objc error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        objc = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="objc")
        assert objc.complete

    def test_php(self):
        group = self.create_group(project=self.project, platform='php', message='php error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        php = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="php")
        assert php.complete

    def test_go(self):
        group = self.create_group(project=self.project, platform='go', message='go error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        go = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="go")
        assert go.complete

    def test_csharp(self):
        group = self.create_group(project=self.project, platform='csharp', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        csharp = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="csharp")
        assert csharp.complete

    def test_perl(self):
        group = self.create_group(project=self.project, platform='perl', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        perl = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="perl")
        assert perl.complete

    def test_elixir(self):
        group = self.create_group(project=self.project, platform='elixir', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        elixir = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="elixir")
        assert elixir.complete

    def test_cfml(self):
        group = self.create_group(project=self.project, platform='cfml', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        cfml = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="cfml")
        assert cfml.complete

    def test_groovy(self):
        group = self.create_group(project=self.project, platform='groovy', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        groovy = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="groovy")
        assert groovy.complete

    def test_csp(self):
        group = self.create_group(project=self.project, platform='csp', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        csp = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="csp")
        assert csp.complete

    def test_release_tracking(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        event = self.create_full_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        release_tracking = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="release_tracking")
        assert release_tracking

    def test_environment_tracking(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        event = self.create_full_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        environment_tracking = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="environment_tracking")
        assert environment_tracking

    def test_user_tracking(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        event = self.create_full_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="user_tracking")
        assert feature_complete

    def test_custom_tags(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        event = self.create_full_event()
        event.data['tags'].append(('foo', 'bar'))
        assert event.get_tag('foo') == 'bar'
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        custom_tags = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="custom_tags")
        assert custom_tags

    def test_source_maps(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        event = self.create_full_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        source_maps = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="source_maps")
        assert source_maps

    def test_breadcrumbs(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        event = self.create_full_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        breadcrumbs = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="breadcrumbs")
        assert breadcrumbs

    def test_user_feedback(self):
        user_feedback_received.send(project=self.project, sender=type(self.project))

        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="user_feedback")
        assert feature_complete

    def test_api_called(self):
        api_called.send(project=self.project, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="api")
        assert feature_complete

    def test_project_created(self):
        project_created.send(project=self.project, user=self.owner, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="first_project")
        assert feature_complete

    def test_member_joined(self):
        member = self.create_member(organization=self.organization, teams=[self.team], user=self.create_user())
        member_joined.send(member=member, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="invite_team")
        assert feature_complete

    def test_assignment(self):
        issue_assigned.send(project=self.project, group=self.group, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="assignment")
        assert feature_complete

    def test_resolved_in_release(self):
        issue_resolved_in_release.send(project=self.project, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="resolved_in_release")
        assert feature_complete

    def test_advanced_search(self):
        advanced_search.send(project=self.project, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="advanced_search")
        assert feature_complete

    def test_save_search(self):
        save_search_created.send(project=self.project, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="saved_search")
        assert feature_complete

    def test_inbound_filters(self):
        inbound_filter_toggled.send(project=self.project, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="inbound_filters")
        assert feature_complete

    def test_alert_rules(self):
        rule = Rule.objects.create(
            project=self.project,
            label="Trivially modified rule",
            data=DEFAULT_RULE_DATA)

        alert_rule_created.send(project=self.project, rule=rule, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="alert_rules")
        assert feature_complete

    def test_issue_tracker_plugin(self):
        plugin_enabled.send(plugin=IssueTrackingPlugin2(), project=self.project, user=self.owner, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="issue_tracker_integration")
        assert feature_complete

    def test_notification_plugin(self):
        plugin_enabled.send(plugin=NotificationPlugin(), project=self.project, user=self.owner, sender=type(self.project))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="notification_integration")
        assert feature_complete

    def test_sso(self):
        sso_enabled.send(organization=self.organization, sender=type(self.organization))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="sso")
        assert feature_complete

    def test_data_scrubber(self):
        data_scrubber_enabled.send(organization=self.organization, sender=type(self.organization))
        feature_complete = FeatureAdoption.objects.get_by_slug(
            organization=self.organization,
            slug="data_scrubbers")
        assert feature_complete

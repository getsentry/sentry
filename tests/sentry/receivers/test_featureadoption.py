from django.utils import timezone

from sentry.models import FeatureAdoption, features
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
from sentry.testutils import TestCase


class FeatureAdoptionTest(TestCase):
    def setUp(self):
        super(FeatureAdoptionTest, self).setUp()
        self.now = timezone.now().replace(microsecond=0)
        self.owner = self.create_user()
        self.organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(team=self.team)

    def test_first_event(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        first_event_received.send(project=self.project, group=group, sender=type(self.project))

        first_event = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="first_event",
            complete=True)
        assert first_event is not None

    def test_javascript(self):
        group = self.create_group(project=self.project, platform='javascript', message='javascript error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        js = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="javascript",
            complete=True)
        assert js is not None

    def test_python(self):
        group = self.create_group(project=self.project, platform='python', message='python error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        python = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="python",
            complete=True)
        assert python is not None

    def test_flask(self):
        group = self.create_group(project=self.project, platform='python', message='python error message')
        event = self.create_event()
        event.data['sdk'] = {'name': 'raven-python:flask'}
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        python = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="python",
            complete=True)
        assert python is not None

        flask = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="flask",
            complete=True)
        assert flask is not None

    def test_node(self):
        group = self.create_group(project=self.project, platform='node', message='node error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        node = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="node",
            complete=True)
        assert node is not None

    def test_ruby(self):
        group = self.create_group(project=self.project, platform='ruby', message='ruby error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        ruby = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="ruby",
            complete=True)
        assert ruby is not None

    def test_java(self):
        group = self.create_group(project=self.project, platform='java', message='java error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        java = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="java",
            complete=True)
        assert java is not None

    def test_cocoa(self):
        group = self.create_group(project=self.project, platform='cocoa', message='cocoa error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        cocoa = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="cocoa",
            complete=True)
        assert cocoa is not None

    def test_objc(self):
        group = self.create_group(project=self.project, platform='objc', message='objc error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        objc = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="objc",
            complete=True)
        assert objc is not None

    def test_php(self):
        group = self.create_group(project=self.project, platform='php', message='php error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        php = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="php",
            complete=True)
        assert php is not None

    def test_go(self):
        group = self.create_group(project=self.project, platform='go', message='go error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        go = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="go",
            complete=True)
        assert go is not None

    def test_csharp(self):
        group = self.create_group(project=self.project, platform='csharp', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        csharp = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="csharp",
            complete=True)
        assert csharp is not None

    def test_perl(self):
        group = self.create_group(project=self.project, platform='perl', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        perl = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="perl",
            complete=True)
        assert perl is not None

    def test_elixir(self):
        group = self.create_group(project=self.project, platform='elixir', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        elixir = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="elixir",
            complete=True)
        assert elixir is not None

    def test_cfml(self):
        group = self.create_group(project=self.project, platform='cfml', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        cfml = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="cfml",
            complete=True)
        assert cfml is not None

    def test_groovy(self):
        group = self.create_group(project=self.project, platform='groovy', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        groovy = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="groovy",
            complete=True)
        assert groovy is not None

    def test_csp(self):
        group = self.create_group(project=self.project, platform='csp', message='C# error message')
        event = self.create_event()
        event_processed.send(project=self.project, group=group, event=event, sender=type(self.project))

        csp = FeatureAdoption.objects.get(
            organization=self.organization,
            feature_slug="csp",
            complete=True)
        assert csp is not None

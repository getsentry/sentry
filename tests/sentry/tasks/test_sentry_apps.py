from __future__ import absolute_import

import six

from celery import Task
from collections import namedtuple
from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone
from mock import patch, call

from sentry.models import Rule, SentryApp, SentryAppInstallation
from sentry.testutils import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.faux import faux, Mock, DictContaining
from sentry.utils.http import absolute_uri
from sentry.receivers.sentry_apps import *  # NOQA
from sentry.utils import json
from sentry.tasks.post_process import post_process_group
from sentry.tasks.sentry_apps import (
    send_alert_event,
    notify_sentry_app,
    process_resource_change,
    process_resource_change_bound,
    installation_webhook,
    workflow_notification,
)

RuleFuture = namedtuple('RuleFuture', ['rule', 'kwargs'])


class TestSendAlertEvent(TestCase):
    def setUp(self):
        self.organization = self.create_organization(slug='foo')
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.project = self.create_project(organization=self.organization)
        self.rule = Rule.objects.create(project=self.project, label='Issa Rule')
        self.install = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=self.sentry_app.slug,
        )

    @patch('sentry.tasks.sentry_apps.safe_urlopen')
    def test_no_sentry_app(self, safe_urlopen):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        send_alert_event(event, self.rule, 9999)

        assert not safe_urlopen.called

    @patch('sentry.tasks.sentry_apps.safe_urlopen')
    def test_no_sentry_app_in_future(self, safe_urlopen):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)
        rule_future = RuleFuture(
            rule=self.rule,
            kwargs={},
        )

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        assert not safe_urlopen.called

    @patch('sentry.tasks.sentry_apps.safe_urlopen')
    def test_no_installation(self, safe_urlopen):
        sentry_app = self.create_sentry_app(
            organization=self.organization
        )
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)
        rule_future = RuleFuture(
            rule=self.rule,
            kwargs={'sentry_app': sentry_app},
        )

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        assert not safe_urlopen.called

    @patch('sentry.tasks.sentry_apps.safe_urlopen')
    def test_send_alert_event(self, safe_urlopen):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)
        rule_future = RuleFuture(
            rule=self.rule,
            kwargs={'sentry_app': self.sentry_app},
        )

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        data = json.loads(faux(safe_urlopen, 0).kwargs['data'])

        assert data == {
            'action': 'triggered',
            'installation': {
                'uuid': self.install.uuid,
            },
            'data': {
                'event': DictContaining(
                    event_id=event.event_id,
                    url=absolute_uri(reverse('sentry-api-0-project-event-details', args=[
                        self.organization.slug,
                        self.project.slug,
                        event.event_id,
                    ])),
                    web_url=absolute_uri(reverse('sentry-organization-event-detail', args=[
                        self.organization.slug,
                        group.id,
                        event.event_id,
                    ])),
                    issue_url=absolute_uri(
                        '/api/0/issues/{}/'.format(group.id),
                    ),
                ),
                'triggered_rule': self.rule.label,
            },
            'actor': {
                'type': 'application',
                'id': 'sentry',
                'name': 'Sentry',
            }
        }

        assert faux(safe_urlopen, 0).kwarg_equals('headers', DictContaining(
            'Content-Type',
            'Request-ID',
            'Sentry-Hook-Resource',
            'Sentry-Hook-Timestamp',
            'Sentry-Hook-Signature',
        ))

    @patch('sentry.net.http.SafeSession.request')
    @patch('sentry.utils.metrics.incr')
    def test_records_request_metrics(self, incr, request):
        request.return_value = Mock(status_code=200)

        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        send_alert_event(event, self.rule.label, self.sentry_app.id)

        incr.assert_has_calls([
            call(
                'webhook.sent',
                instance='sentry.tasks.sentry_apps.send_alert_event',
                tags={
                    'integration_platform': True,
                    'event': 'event_alert.triggered',
                    'sentry_app': self.sentry_app.slug,
                },
                skip_internal=False,
            ),
            call(
                'webhook.delivered',
                instance='sentry.tasks.sentry_apps.send_alert_event',
                tags={
                    'integration_platform': True,
                    'event': 'event_alert.triggered',
                    'sentry_app': self.sentry_app.slug,
                    'status_code': 200,
                },
                skip_internal=False,
            ),
        ], any_order=True)


@patch('sentry.net.http.SafeSession.request')
class TestProcessResourceChange(TestCase):
    def setUp(self):
        self.project = self.create_project()

        self.sentry_app = self.create_sentry_app(
            organization=self.project.organization,
            events=['issue.created'],
        )

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=self.sentry_app.slug,
        )

    def test_group_created_sends_webhook(self, request):
        issue = self.create_group(project=self.project)
        event = self.create_event(group=issue)

        with self.tasks():
            post_process_group(
                event=event,
                is_new=True,
                is_regression=False,
                is_sample=False,
                is_new_group_environment=False,
            )

        data = json.loads(faux(request, 0).kwargs['data'])

        assert data['action'] == 'created'
        assert data['installation']['uuid'] == self.install.uuid
        assert data['data']['issue']['id'] == six.text_type(issue.id)
        assert faux(request, 0).kwargs_contain('headers.Content-Type')
        assert faux(request, 0).kwargs_contain('headers.Request-ID')
        assert faux(request, 0).kwargs_contain('headers.Sentry-Hook-Resource')
        assert faux(request, 0).kwargs_contain('headers.Sentry-Hook-Timestamp')
        assert faux(request, 0).kwargs_contain('headers.Sentry-Hook-Signature')

    def test_does_not_process_disallowed_event(self, request):
        process_resource_change('delete', 'Group', self.create_group().id)
        assert len(request.mock_calls) == 0

    def test_does_not_process_sentry_apps_without_issue_webhooks(self, request):
        SentryAppInstallation.objects.all().delete()
        SentryApp.objects.all().delete()

        # DOES NOT subscribe to Issue events
        self.create_sentry_app_installation(organization=self.organization)

        process_resource_change('created', 'Group', self.create_group().id)

        assert len(request.mock_calls) == 0

    @patch('sentry.tasks.sentry_apps._process_resource_change')
    def test_process_resource_change_bound_passes_retry_object(self, process, request):
        group = self.create_group(project=self.project)

        process_resource_change_bound('created', 'Group', group.id)

        task = faux(process).kwargs['retryer']
        assert isinstance(task, Task)

    @with_feature('organizations:integrations-event-hooks')
    def test_error_created_sends_webhook(self, request):
        sentry_app = self.create_sentry_app(
            organization=self.project.organization,
            events=['error.created'],
        )
        install = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=sentry_app.slug,
        )

        one_min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        event = self.store_event(
            data={
                'message': 'Foo bar',
                'exception': {"type": "Foo", "value": "shits on fiah yo"},
                'level': 'error',
                'timestamp': one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False
        )

        with self.tasks():
            post_process_group(
                event=event,
                is_new=False,
                is_regression=False,
                is_sample=False,
                is_new_group_environment=False,
            )

        data = json.loads(faux(request, 0).kwargs['data'])

        assert data['action'] == 'created'
        assert data['installation']['uuid'] == install.uuid
        assert data['data']['error']['event_id'] == event.event_id
        assert faux(request, 0).kwargs_contain('headers.Content-Type')
        assert faux(request, 0).kwargs_contain('headers.Request-ID')
        assert faux(request, 0).kwargs_contain('headers.Sentry-Hook-Resource')
        assert faux(request, 0).kwargs_contain('headers.Sentry-Hook-Timestamp')
        assert faux(request, 0).kwargs_contain('headers.Sentry-Hook-Signature')

    @patch('sentry.utils.metrics.incr')
    def test_records_request_metrics(self, incr, request):
        request.return_value = Mock(status_code=200)

        process_resource_change_bound(
            'created',
            'Group',
            self.create_group().id,
        )

        incr.assert_has_calls([
            call(
                'webhook.sent',
                instance='sentry.tasks.sentry_apps.process_resource_change',
                tags={
                    'integration_platform': True,
                    'event': 'issue.created',
                    'sentry_app': self.sentry_app.slug,
                },
                skip_internal=False,
            ),
            call(
                'webhook.delivered',
                instance='sentry.tasks.sentry_apps.process_resource_change',
                tags={
                    'integration_platform': True,
                    'event': 'issue.created',
                    'sentry_app': self.sentry_app.slug,
                    'status_code': 200,
                },
                skip_internal=False,
            )
        ], any_order=True)


@patch('sentry.mediators.sentry_app_installations.InstallationNotifier.run')
class TestInstallationWebhook(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.user = self.create_user()

        self.sentry_app = self.create_sentry_app(
            organization=self.project.organization,
        )

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=self.sentry_app.slug,
        )

    def test_sends_installation_notification(self, run):
        installation_webhook(self.install.id, self.user.id)

        run.assert_called_with(
            install=self.install,
            user=self.user,
            action='created',
        )

    def test_gracefully_handles_missing_install(self, run):
        installation_webhook(999, self.user.id)
        assert len(run.mock_calls) == 0

    def test_gracefully_handles_missing_user(self, run):
        installation_webhook(self.install.id, 999)
        assert len(run.mock_calls) == 0


@patch('sentry.net.http.SafeSession.request')
class TestWorkflowNotification(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.user = self.create_user()

        self.sentry_app = self.create_sentry_app(
            organization=self.project.organization,
            events=['issue.resolved', 'issue.ignored', 'issue.assigned'],
        )

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=self.sentry_app.slug,
        )

        self.issue = self.create_group(project=self.project)

    def test_sends_resolved_webhook(self, request):
        workflow_notification(self.install.id, self.issue.id, 'resolved', self.user.id)

        assert faux(request, 0).kwarg_equals('url', self.sentry_app.webhook_url)
        assert faux(request, 0).kwarg_equals('data.action', 'resolved', format='json')
        assert faux(request, 0).kwarg_equals('headers.Sentry-Hook-Resource', 'issue')
        assert faux(request, 0).kwarg_equals(
            'data.data.issue.id', six.binary_type(
                self.issue.id), format='json')

    def test_sends_resolved_webhook_as_Sentry_without_user(self, request):
        workflow_notification(self.install.id, self.issue.id, 'resolved', None)

        assert faux(request, 0).kwarg_equals('data.actor.type', 'application', format='json')
        assert faux(request, 0).kwarg_equals('data.actor.id', 'sentry', format='json')
        assert faux(request, 0).kwarg_equals('data.actor.name', 'Sentry', format='json')

    def test_does_not_send_if_no_service_hook_exists(self, request):
        sentry_app = self.create_sentry_app(
            name='Another App',
            organization=self.project.organization,
            events=[],
        )
        install = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=sentry_app.slug,
        )
        workflow_notification(install.id, self.issue.id, 'assigned', self.user.id)
        assert not request.called

    def test_does_not_send_if_event_not_in_app_events(self, request):
        sentry_app = self.create_sentry_app(
            name='Another App',
            organization=self.project.organization,
            events=['issue.resolved', 'issue.ignored'],
        )
        install = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=sentry_app.slug,
        )
        workflow_notification(install.id, self.issue.id, 'assigned', self.user.id)
        assert not request.called

    @patch('sentry.utils.metrics.incr')
    def test_records_request_metrics(self, incr, request):
        request.return_value = Mock(status_code=200)

        workflow_notification(self.install.id, self.issue.id, 'resolved', self.user.id)

        incr.assert_has_calls([
            call(
                'webhook.sent',
                instance='sentry.tasks.sentry_apps.workflow_notification',
                tags={
                    'integration_platform': True,
                    'event': 'issue.resolved',
                    'sentry_app': self.sentry_app.slug,
                },
                skip_internal=False,
            ),
            call(
                'webhook.delivered',
                instance='sentry.tasks.sentry_apps.workflow_notification',
                tags={
                    'integration_platform': True,
                    'event': 'issue.resolved',
                    'sentry_app': self.sentry_app.slug,
                    'status_code': 200,
                },
                skip_internal=False,
            )
        ], any_order=True)

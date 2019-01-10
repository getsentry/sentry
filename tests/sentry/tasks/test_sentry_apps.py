from __future__ import absolute_import

from collections import namedtuple
from django.core.urlresolvers import reverse
from mock import patch

from sentry.models import Rule
from sentry.testutils import TestCase
from sentry.tasks.sentry_apps import notify_sentry_app
from sentry.testutils.helpers.faux import faux
from sentry.utils.http import absolute_uri

RuleFuture = namedtuple('RuleFuture', ['rule', 'kwargs'])


class DictContaining(object):
    def __init__(self, *keys):
        self.keys = keys

    def __eq__(self, other):
        return all([k in other.keys() for k in self.keys])


class TestSentryAppAlertEvent(TestCase):
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

        event_data = self._get_event_data(event)

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        data = faux(safe_urlopen).kwargs['data']
        assert data == {
            'action': 'triggered',
            'installation': {
                'uuid': self.install.uuid,
            },
            'data': {
                'event': event_data,
                'triggered_rule': self.rule.label,
            },
            'actor': {
                'type': 'application',
                'id': 'sentry',
                'name': 'Sentry',
            }
        }

        assert faux(safe_urlopen).kwarg_equals('headers', DictContaining(
            'Content-Type',
            'Request-ID',
            'Sentry-Hook-Resource',
            'Sentry-Hook-Timestamp',
            'Sentry-Hook-Signature',
        ))

    def _get_event_data(self, event):
        group = event.group
        event_data = event.as_dict()
        event_data['url'] = absolute_uri(reverse('sentry-api-0-project-event-details', args=[
            self.organization.slug,
            self.project.slug,
            event.id,
        ]))
        event_data['web_url'] = absolute_uri(reverse('sentry-group-event', args=[
            self.organization.slug,
            self.project.slug,
            group.id,
            event.id,
        ]))
        event_data['issue_url'] = absolute_uri(
            '/api/0/issues/{}/'.format(group.id),
        )
        return event_data

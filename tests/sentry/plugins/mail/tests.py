# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.core import mail
from django.utils import timezone
from exam import fixture
from mock import Mock

from sentry.digests.notifications import (
    build_digest,
    event_to_record,
)
from sentry.interfaces.stacktrace import Stacktrace
from sentry.models import (
    Activity,
    Event,
    Group,
    OrganizationMember,
    OrganizationMemberTeam,
    Release,
    Rule,
)
from sentry.plugins import Notification
from sentry.plugins.sentry_mail.models import MailPlugin
from sentry.testutils import TestCase
from sentry.utils.email import MessageBuilder


class MailPluginTest(TestCase):
    @fixture
    def plugin(self):
        return MailPlugin()

    @mock.patch('sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d))
    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin.get_sendable_users', Mock(return_value=[]))
    def test_should_notify_no_sendable_users(self):
        assert not self.plugin.should_notify(group=Mock(), event=Mock())

    def test_simple_notification(self):
        group = self.create_group(message='Hello world')
        event = self.create_event(group=group, message='Hello world')

        rule = Rule.objects.create(project=self.project, label='my rule')

        notification = Notification(event=event, rule=rule)

        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            self.plugin.notify(notification)

        msg = mail.outbox[0]
        assert msg.subject == '[Sentry] [foo Bar] ERROR: Hello world'
        assert 'my rule' in msg.alternatives[0][0]

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_notify_users_renders_interfaces_with_utf8(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
        )

        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_email_html.return_value = u'רונית מגן'
        stacktrace.get_title.return_value = 'Stacktrace'

        event = Event()
        event.group = group
        event.project = self.project
        event.message = 'hello world'
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        notification = Notification(event=event)

        with self.options({'system.url-prefix': 'http://example.com'}):
            self.plugin.notify(notification)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_email_html.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_notify_users_renders_interfaces_with_utf8_fix_issue_422(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
        )

        stacktrace = Mock(spec=Stacktrace)
        stacktrace.to_email_html.return_value = u'רונית מגן'
        stacktrace.get_title.return_value = 'Stacktrace'

        event = Event()
        event.group = group
        event.project = self.project
        event.message = 'Soubor ji\xc5\xbe existuje'
        event.interfaces = {'sentry.interfaces.Stacktrace': stacktrace}

        notification = Notification(event=event)

        with self.options({'system.url-prefix': 'http://example.com'}):
            self.plugin.notify(notification)

        stacktrace.get_title.assert_called_once_with()
        stacktrace.to_email_html.assert_called_once_with(event)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_notify_users_does_email(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
            message='hello world',
            logger='root',
        )

        event = Event(
            group=group,
            message=group.message,
            project=self.project,
            datetime=group.last_seen,
        )

        notification = Notification(event=event)

        with self.options({'system.url-prefix': 'http://example.com'}):
            self.plugin.notify(notification)

        assert _send_mail.call_count is 1
        args, kwargs = _send_mail.call_args
        self.assertEquals(kwargs.get('project'), self.project)
        self.assertEquals(kwargs.get('reference'), group)
        assert kwargs.get('subject') == u"[{0} {1}] ERROR: hello world".format(
            self.team.name, self.project.name)

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_multiline_error(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
            message='hello world\nfoo bar',
            logger='root',
        )

        event = Event(
            group=group,
            message=group.message,
            project=self.project,
            datetime=group.last_seen,
        )

        notification = Notification(event=event)

        with self.options({'system.url-prefix': 'http://example.com'}):
            self.plugin.notify(notification)

        assert _send_mail.call_count is 1
        args, kwargs = _send_mail.call_args
        assert kwargs.get('subject') == u"[{0} {1}] ERROR: hello world".format(
            self.team.name, self.project.name)

    def test_get_sendable_users(self):
        from sentry.models import UserOption, User

        user = self.create_user(email='foo@example.com', is_active=True)
        user2 = self.create_user(email='baz@example.com', is_active=True)
        self.create_user(email='baz2@example.com', is_active=True)

        # user with inactive account
        self.create_user(email='bar@example.com', is_active=False)
        # user not in any groups
        self.create_user(email='bar2@example.com', is_active=True)

        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)

        project = self.create_project(name='Test', team=team)
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                user=user,
                organization=organization,
            ),
            team=team,
        )
        self.create_member(user=user2, organization=organization, teams=[team])

        # all members
        assert (sorted(set([user.pk, user2.pk])) ==
                sorted(self.plugin.get_sendable_users(project)))

        # disabled user2
        UserOption.objects.create(key='mail:alert', value=0,
                                  project=project, user=user2)

        assert user2.pk not in self.plugin.get_sendable_users(project)

        user4 = User.objects.create(username='baz4', email='bar@example.com',
                                    is_active=True)
        self.create_member(user=user4, organization=organization, teams=[team])
        assert user4.pk in self.plugin.get_sendable_users(project)

        # disabled by default user4
        uo1 = UserOption.objects.create(key='subscribe_by_default', value='0',
                                  project=project, user=user4)

        assert user4.pk not in self.plugin.get_sendable_users(project)

        uo1.delete()

        UserOption.objects.create(key='subscribe_by_default', value=u'0',
                                  project=project, user=user4)

        assert user4.pk not in self.plugin.get_sendable_users(project)

    def test_notify_users_with_utf8_subject(self):
        group = self.create_group(message=u'רונית מגן')
        event = self.create_event(group=group, message='Hello world')

        notification = Notification(event=event)

        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            self.plugin.notify(notification)

        msg = mail.outbox[0]
        assert msg.subject == u'[Sentry] [foo Bar] ERROR: רונית מגן'

    @mock.patch.object(MailPlugin, 'notify', side_effect=MailPlugin.notify, autospec=True)
    @mock.patch.object(MessageBuilder, 'send_async', autospec=True)
    def test_notify_digest(self, send_async, notify):
        project = self.event.project
        rule = project.rule_set.all()[0]
        digest = build_digest(
            project,
            (
                event_to_record(self.create_event(group=self.create_group()), (rule,)),
                event_to_record(self.event, (rule,)),
            ),
        )
        self.plugin.notify_digest(project, digest)
        assert send_async.call_count is 1
        assert notify.call_count is 0

    @mock.patch.object(MailPlugin, 'notify', side_effect=MailPlugin.notify, autospec=True)
    @mock.patch.object(MessageBuilder, 'send_async', autospec=True)
    def test_notify_digest_single_record(self, send_async, notify):
        project = self.event.project
        rule = project.rule_set.all()[0]
        digest = build_digest(
            project,
            (
                event_to_record(self.event, (rule,)),
            ),
        )
        self.plugin.notify_digest(project, digest)
        assert send_async.call_count is 1
        assert notify.call_count is 1

    @mock.patch(
        'sentry.models.ProjectOption.objects.get_value',
        Mock(side_effect=lambda p, k, d: "[Example prefix] " if k == "mail:subject_prefix" else d)
    )
    def test_notify_digest_subject_prefix(self):
        project = self.event.project
        rule = project.rule_set.all()[0]
        digest = build_digest(
            project,
            (
                event_to_record(self.create_event(group=self.create_group()), (rule,)),
                event_to_record(self.event, (rule,)),
            ),
        )

        with self.tasks():
            self.plugin.notify_digest(project, digest)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject.startswith('[Example prefix] [foo Bar]')

    @mock.patch(
        'sentry.models.ProjectOption.objects.get_value',
        Mock(side_effect=lambda p, k, d: "[Example prefix] " if k == "mail:subject_prefix" else d)
    )
    def test_assignment(self):
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=Activity.ASSIGNED,
            user=self.create_user('foo@example.com'),
            data={
                'assignee': str(self.user.id),
            },
        )

        with self.tasks():
            self.plugin.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == 'Re: [Example prefix] [foo Bar] ERROR: Foo bar'
        assert msg.to == [self.user.email]

    def test_note(self):
        user_foo = self.create_user('foo@example.com')

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=Activity.NOTE,
            user=user_foo,
            data={
                'text': 'sup guise',
            },
        )

        self.project.team.organization.member_set.create(user=user_foo)

        with self.tasks():
            self.plugin.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == 'Re: [Sentry] [foo Bar] ERROR: Foo bar'
        assert msg.to == [self.user.email]

    def test_release(self):
        user_foo = self.create_user('foo@example.com')

        release = Release.objects.create(
            project=self.project,
            version='a' * 40,
        )

        activity = Activity.objects.create(
            project=self.project,
            type=Activity.RELEASE,
            user=user_foo,
            data={
                'version': release.version,
            },
        )

        self.project.team.organization.member_set.create(user=user_foo)

        with self.tasks():
            self.plugin.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == '[Sentry] Release %s' % (release.version,)
        assert msg.to == [self.user.email]

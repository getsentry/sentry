# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import datetime, timedelta

import mock
import pytz
import six
from django.contrib.auth.models import AnonymousUser
from django.core import mail
from django.utils import timezone
from exam import fixture
from mock import Mock

from sentry.api.serializers import (
    serialize, ProjectUserReportSerializer
)
from sentry.digests.notifications import build_digest, event_to_record
from sentry.interfaces.stacktrace import Stacktrace
from sentry.models import (
    Activity, Event, Group, GroupSubscription, OrganizationMember, OrganizationMemberTeam,
    ProjectOwnership, Rule, User, UserOption, UserReport
)
from sentry.ownership.grammar import Rule as grammar_rule
from sentry.ownership.grammar import Owner, Matcher, dump_schema
from sentry.plugins import Notification
from sentry.plugins.sentry_mail.activity.base import ActivityEmail
from sentry.plugins.sentry_mail.models import MailPlugin
from sentry.testutils import TestCase
from sentry.utils.email import MessageBuilder


class MailPluginTest(TestCase):
    @fixture
    def plugin(self):
        return MailPlugin()

    @mock.patch(
        'sentry.models.ProjectOption.objects.get_value', Mock(side_effect=lambda p, k, d: d)
    )
    @mock.patch(
        'sentry.plugins.sentry_mail.models.MailPlugin.get_sendable_users', Mock(return_value=[])
    )
    def test_should_notify_no_sendable_users(self):
        assert not self.plugin.should_notify(group=Mock(), event=Mock())

    def test_simple_notification(self):
        group = self.create_group(message='Hello world')
        event = self.create_event(group=group, message='Hello world', tags={'level': 'error'})

        rule = Rule.objects.create(project=self.project, label='my rule')

        notification = Notification(event=event, rule=rule)

        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            self.plugin.notify(notification)

        msg = mail.outbox[0]
        assert msg.subject == '[Sentry] BAR-1 - Hello world'
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
            short_id=2,
        )

        event = Event(
            group=group,
            message=group.message,
            project=self.project,
            datetime=group.last_seen,
            data={'tags': [
                ('level', 'error'),
            ]},
        )

        notification = Notification(event=event)

        with self.options({'system.url-prefix': 'http://example.com'}):
            self.plugin.notify(notification)

        assert _send_mail.call_count is 1
        args, kwargs = _send_mail.call_args
        self.assertEquals(kwargs.get('project'), self.project)
        self.assertEquals(kwargs.get('reference'), group)
        assert kwargs.get('subject') == u'BAR-2 - hello world'

    @mock.patch('sentry.plugins.sentry_mail.models.MailPlugin._send_mail')
    def test_multiline_error(self, _send_mail):
        group = Group(
            id=2,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
            message='hello world\nfoo bar',
            logger='root',
            short_id=2,
        )

        event = Event(
            group=group,
            message=group.message,
            project=self.project,
            datetime=group.last_seen,
            data={'tags': [
                ('level', 'error'),
            ]},
        )

        notification = Notification(event=event)

        with self.options({'system.url-prefix': 'http://example.com'}):
            self.plugin.notify(notification)

        assert _send_mail.call_count is 1
        args, kwargs = _send_mail.call_args
        assert kwargs.get('subject') == u'BAR-2 - hello world'

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

        project = self.create_project(name='Test', teams=[team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                user=user,
                organization=organization,
            ),
            team=team,
        )
        self.create_member(user=user2, organization=organization, teams=[team])

        # all members
        assert (sorted(set([user.pk, user2.pk])) == sorted(self.plugin.get_sendable_users(project)))

        # disabled user2
        UserOption.objects.create(key='mail:alert', value=0, project=project, user=user2)

        assert user2.pk not in self.plugin.get_sendable_users(project)

        user4 = User.objects.create(username='baz4', email='bar@example.com', is_active=True)
        self.create_member(user=user4, organization=organization, teams=[team])
        assert user4.pk in self.plugin.get_sendable_users(project)

        # disabled by default user4
        uo1 = UserOption.objects.create(
            key='subscribe_by_default', value='0', project=project, user=user4
        )

        assert user4.pk not in self.plugin.get_sendable_users(project)

        uo1.delete()

        UserOption.objects.create(
            key='subscribe_by_default', value=u'0', project=project, user=user4
        )

        assert user4.pk not in self.plugin.get_sendable_users(project)

    def test_notify_users_with_utf8_subject(self):
        group = self.create_group(message='Hello world')
        event = self.create_event(group=group, message=u'רונית מגן', tags={'level': 'error'})

        notification = Notification(event=event)

        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            self.plugin.notify(notification)

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.subject == u'[Sentry] BAR-1 - רונית מגן'

    def test_get_digest_subject(self):
        assert self.plugin.get_digest_subject(
            mock.Mock(qualified_short_id='BAR-1'),
            {mock.sentinel.group: 3},
            datetime(2016, 9, 19, 1, 2, 3, tzinfo=pytz.utc),
        ) == 'BAR-1 - 1 new alert since Sept. 19, 2016, 1:02 a.m. UTC'

    @mock.patch.object(MailPlugin, 'notify', side_effect=MailPlugin.notify, autospec=True)
    def test_notify_digest(self, notify):
        project = self.event.project
        rule = project.rule_set.all()[0]
        digest = build_digest(
            project,
            (
                event_to_record(self.create_event(group=self.create_group()), (rule, )),
                event_to_record(self.event, (rule, )),
            ),
        )

        with self.tasks():
            self.plugin.notify_digest(project, digest)

        assert notify.call_count is 0
        assert len(mail.outbox) == 1

        message = mail.outbox[0]
        assert 'List-ID' in message.message()

    @mock.patch.object(MailPlugin, 'notify', side_effect=MailPlugin.notify, autospec=True)
    @mock.patch.object(MessageBuilder, 'send_async', autospec=True)
    def test_notify_digest_single_record(self, send_async, notify):
        project = self.event.project
        rule = project.rule_set.all()[0]
        digest = build_digest(
            project,
            (event_to_record(self.event, (rule, )), ),
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
                event_to_record(self.create_event(group=self.create_group()), (rule, )),
                event_to_record(self.event, (rule, )),
            ),
        )

        with self.tasks():
            self.plugin.notify_digest(project, digest)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject.startswith('[Example prefix]')

    def test_assignment(self):
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=Activity.ASSIGNED,
            user=self.create_user('foo@example.com'),
            data={
                'assignee': six.text_type(self.user.id),
                'assigneeType': 'user',
            },
        )

        with self.tasks():
            self.plugin.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == 'Re: [Sentry] BAR-1 - \xe3\x81\x93\xe3\x82\x93\xe3\x81\xab\xe3\x81\xa1\xe3\x81\xaf'
        assert msg.to == [self.user.email]

    def test_assignment_team(self):
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=Activity.ASSIGNED,
            user=self.create_user('foo@example.com'),
            data={
                'assignee': six.text_type(self.project.teams.first().id),
                'assigneeType': 'team',
            },
        )

        with self.tasks():
            self.plugin.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == 'Re: [Sentry] BAR-1 - \xe3\x81\x93\xe3\x82\x93\xe3\x81\xab\xe3\x81\xa1\xe3\x81\xaf'
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

        self.project.teams.first().organization.member_set.create(user=user_foo)

        with self.tasks():
            self.plugin.notify_about_activity(activity)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]

        assert msg.subject == 'Re: [Sentry] BAR-1 - \xe3\x81\x93\xe3\x82\x93\xe3\x81\xab\xe3\x81\xa1\xe3\x81\xaf'
        assert msg.to == [self.user.email]

    def test_notify_with_suspect_commits(self):
        release = self.create_release(project=self.project, user=self.user)
        group = self.create_group(project=self.project, first_release=release)
        event = self.create_event(group=group, tags={'sentry:release': release.version})

        notification = Notification(event=event)

        with self.tasks(), self.options({'system.url-prefix': 'http://example.com'}), self.feature('organizations:suggested-commits'):
            self.plugin.notify(notification)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]

        assert 'Suspect Commits' in msg.body


class MailPluginSignalsTest(TestCase):
    @fixture
    def plugin(self):
        return MailPlugin()

    def test_user_feedback(self):
        user_foo = self.create_user('foo@example.com')

        report = UserReport.objects.create(
            project=self.project,
            group=self.group,
            name='Homer Simpson',
            email='homer.simpson@example.com'
        )

        self.project.teams.first().organization.member_set.create(user=user_foo)

        with self.tasks():
            self.plugin.handle_signal(
                name='user-reports.created',
                project=self.project,
                payload={
                    'report': serialize(report, AnonymousUser(), ProjectUserReportSerializer()),
                },
            )

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == '[Sentry] {} - New Feedback from Homer Simpson'.format(
            self.group.qualified_short_id,
        )
        assert msg.to == [self.user.email]


class ActivityEmailTestCase(TestCase):
    def get_fixture_data(self, users):
        organization = self.create_organization(owner=self.create_user())
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])
        group = self.create_group(project=project)

        users = [self.create_user() for _ in range(users)]

        for user in users:
            self.create_member([team], user=user, organization=organization)
            GroupSubscription.objects.subscribe(group, user)

        return group, users

    def test_get_participants(self):
        group, (actor, other) = self.get_fixture_data(2)

        email = ActivityEmail(Activity(
            project=group.project,
            group=group,
            user=actor,
        ))

        assert set(email.get_participants()) == set([other])

        UserOption.objects.set_value(user=actor, key='self_notifications', value='1')

        assert set(email.get_participants()) == set([actor, other])

    def test_get_participants_without_actor(self):
        group, (user, ) = self.get_fixture_data(1)

        email = ActivityEmail(Activity(
            project=group.project,
            group=group,
        ))

        assert set(email.get_participants()) == set([user])

    def test_get_subject(self):
        group, (user, ) = self.get_fixture_data(1)

        email = ActivityEmail(Activity(
            project=group.project,
            group=group,
        ))

        with mock.patch('sentry.models.ProjectOption.objects.get_value') as get_value:
            get_value.side_effect = lambda project, key, default=None: \
                "[Example prefix] " if key == "mail:subject_prefix" else default
            assert email.get_subject_with_prefix().startswith('[Example prefix] ')


class MailPluginOwnersTest(TestCase):
    @fixture
    def plugin(self):
        return MailPlugin()

    def setUp(self):
        self.user = self.create_user(email='user1@example.com', is_active=True)
        self.user2 = self.create_user(email='user2@example.com', is_active=True)

        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)

        self.project = self.create_project(name='Test Project', teams=[self.team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                user=self.user,
                organization=self.organization,
            ),
            team=self.team,
        )
        self.create_member(user=self.user2, organization=self.organization, teams=[self.team])

        self.rule_team = grammar_rule(Matcher('path', '*.py'), [Owner('team', self.team.slug)])
        self.rule_user = grammar_rule(Matcher('path', '*.jx'), [Owner('user', self.user2.email)])
        self.rule_users = grammar_rule(Matcher('path', '*.cbl'), [
            Owner('user', self.user.email),
            Owner('user', self.user2.email),
        ])
        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([
                self.rule_team,
                self.rule_user,
                self.rule_users,
            ]),
            fallthrough=True,
        )

        self.group = self.create_group(
            first_seen=timezone.now() - timedelta(days=3),
            last_seen=timezone.now() - timedelta(hours=3),
            project=self.project,
            message='hello  world this is a group',
            logger='root',
        )
        self.group1 = self.create_group(
            project=self.project,
            first_seen=timezone.now() - timedelta(days=2),
            last_seen=timezone.now() - timedelta(hours=2),
            message='group 2',
            logger='root',
        )
        self.group2 = self.create_group(
            project=self.project,
            first_seen=timezone.now() - timedelta(days=1),
            last_seen=timezone.now() - timedelta(hours=1),
            message='group 3',
            logger='root',
        )
        self.event_single_user = self.create_event(
            group=self.group,
            message=self.group.message,
            datetime=self.group.last_seen,
            project=self.project,
            data=self.make_event_data('foo.jx'),
        )
        self.event_all_users = self.create_event(
            group=self.group1,
            message=self.group1.message,
            datetime=self.group1.last_seen,
            project=self.project,
            data=self.make_event_data('foo.cbl'),
        )
        self.event_team = self.create_event(
            group=self.group2,
            message=self.group2.message,
            datetime=self.group2.last_seen,
            project=self.project,
            data=self.make_event_data('foo.py'),
        )

    def make_event_data(self, filename, url='http://example.com'):
        data = {
            'tags': [('level', 'error')],
            'sentry.interfaces.Stacktrace': {
                'frames': [
                    {
                        'lineno': 1,
                        'filename': filename,
                    },
                ],
            },
            'sentry.interfaces.Http': {
                'url': url
            },
        }
        return data

    def assert_notify(self, event, emails_sent_to):
        mail.outbox = []
        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            self.plugin.notify(Notification(event=event))
        assert len(mail.outbox) == len(emails_sent_to)
        assert sorted(email.to[0] for email in mail.outbox) == sorted(emails_sent_to)

    def assert_notify_users(self, event, users):
        mail.outbox = []
        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            self.plugin.notify(Notification(event=event), users)
        assert len(mail.outbox) == len(users)
        assert sorted(
            email.to[0] for email in mail.outbox) == sorted(
            User.objects.filter(
                id__in=users).values_list(
                'email',
                flat=True))

    def assert_digest_email(self, email, user_email, subject=None,
                            event_messages=None, not_event_messages=None):
        assert email.to == [user_email]
        if subject:
            assert subject in email.subject
        if event_messages:
            for message in event_messages:
                assert message in email.body
        if not_event_messages:
            for message in not_event_messages:
                assert not (message in email.body)

    def test_get_send_to_with_team_owners(self):
        event = Event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.py')
        )
        assert (sorted(set([self.user.pk, self.user2.pk])) == sorted(
            self.plugin.get_send_to(self.project, event)))

    def test_get_send_to_with_user_owners(self):
        event = Event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.cbl')
        )
        assert (sorted(set([self.user.pk, self.user2.pk])) == sorted(
            self.plugin.get_send_to(self.project, event)))

    def test_get_send_to_with_user_owner(self):
        event = Event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.jx')
        )
        assert (sorted(set([self.user2.pk])) == sorted(
            self.plugin.get_send_to(self.project, event)))

    def test_get_send_to_with_fallthrough(self):
        event = Event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.jx')
        )
        assert (sorted(set([self.user2.pk])) == sorted(
            self.plugin.get_send_to(self.project, event)))

    def test_get_send_to_without_fallthrough(self):
        ProjectOwnership.objects.get(project_id=self.project.id).update(fallthrough=False)
        event = Event(
            group=self.group,
            message=self.group.message,
            project=self.project,
            datetime=self.group.last_seen,
            data=self.make_event_data('foo.cpp')
        )
        assert [] == sorted(self.plugin.get_send_to(self.project, event))

    def test_notify_with_specific_users(self):
        group = self.create_group(project=self.project)
        self.assert_notify_users(self.create_event(group=group), [self.user.id, self.user2.id])
        self.assert_notify_users(self.create_event(group=group), [self.user.id])
        self.assert_notify_users(self.create_event(group=group), [])

    def test_notify_users_with_owners(self):
        self.assert_notify(self.event_all_users, [self.user.email, self.user2.email])
        self.assert_notify(self.event_team, [self.user.email, self.user2.email])
        self.assert_notify(self.event_single_user, [self.user2.email])

    def test_notify_digest_with_owners(self):
        rule = self.project.rule_set.all()[0]
        records = (
            event_to_record(self.event_team, (rule,)),
            event_to_record(self.event_all_users, (rule,)),
            event_to_record(self.event_single_user, (rule,)),
        )
        digest = build_digest(self.project, records)
        with self.tasks():
            self.plugin.notify_digest(self.project, digest)

        assert len(mail.outbox) == 2
        emails = sorted(mail.outbox, key=lambda e: e.to)

        self.assert_digest_email(
            email=emails[0],
            user_email=self.user.email,
            # subject=u'[Sentry] TEST-PROJECT-2 - group 2',
            event_messages=[self.event_all_users.message, self.event_team.message],
            not_event_messages=[self.event_single_user.message],
        )
        self.assert_digest_email(
            email=emails[1],
            user_email=self.user2.email,
            # subject=u'[Sentry] TEST-PROJECT-1 - 2 new alerts',
            event_messages=[self.event_single_user.message, self.event_all_users.message],
        )

    def test_notify_digest(self):
        self.team1 = self.create_team()
        self.team2 = self.create_team()
        self.team3 = self.create_team()
        self.project = self.create_project(teams=[self.team1, self.team2, self.team3])

        self.user1 = self.create_user(email='1@foo.com')
        self.user2 = self.create_user(email='2@foo.com')
        self.user3 = self.create_user(email='3@foo.com')
        self.user4 = self.create_user(email='4@foo.com')
        self.user5 = self.create_user(email='5@foo.com')
        self.user6 = self.create_user(email='6@foo.com')
        self.user7 = self.create_user(email='7@foo.com')
        self.user8 = self.create_user(email='8@foo.com')

        self.create_member(user=self.user1, organization=self.organization, teams=[self.team1])
        self.create_member(user=self.user2, organization=self.organization, teams=[self.team1])
        self.create_member(user=self.user3, organization=self.organization, teams=[self.team1])
        self.create_member(
            user=self.user4,
            organization=self.organization,
            teams=[
                self.team1,
                self.team2])
        self.create_member(
            user=self.user5,
            organization=self.organization,
            teams=[
                self.team2,
                self.create_team()])
        self.create_member(user=self.user6, organization=self.organization, teams=[self.team2])
        self.create_member(user=self.user7, organization=self.organization, teams=[self.team3])
        self.create_member(user=self.user8, organization=self.organization, teams=[self.team3])

        self.matcher1 = Matcher('path', '*.py')
        self.matcher2 = Matcher('url', '*.co')
        self.matcher3 = Matcher('path', '*.cbl')
        self.matcher4 = Matcher('path', '*.cpp')

        self.rule1 = grammar_rule(
            self.matcher1, [
                Owner(
                    'user', self.user1.email), Owner(
                    'team', self.team1.slug)])
        self.rule2 = grammar_rule(
            self.matcher2, [
                Owner(
                    'user', self.user1.email), Owner(
                    'team', self.team2.slug)])
        self.rule3 = grammar_rule(self.matcher3, [
            Owner('user', self.user6.email),
            Owner('user', self.user4.email),
            Owner('user', self.user3.email),
            Owner('user', self.user1.email),
        ])
        self.rule4 = grammar_rule(
            self.matcher3, [
                Owner(
                    'team', self.team1.slug), Owner(
                    'team', self.team2.slug)])
        self.rule5 = grammar_rule(self.matcher4, [Owner('user', self.user7.email)])

        self.ownership = ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([
                self.rule1,
                self.rule2,
                self.rule3,
                self.rule4,
                self.rule5,
            ]),
            fallthrough=True,
        )

        event1 = self.create_event(
            data=self.make_event_data('hello.world'),
            group=self.create_group(
                project=self.project,
                message='event1',
            ),
            message='event1',
        )
        event2 = self.create_event(
            data=self.make_event_data('hello.py'),
            group=self.create_group(
                project=self.project,
                message='event2',
            ),
            message='event2',
        )
        event3 = self.create_event(
            data=self.make_event_data('hello.cbl'),
            group=self.create_group(
                project=self.project,
                message='event3',
            ),
            message='event3',
        )
        event4 = self.create_event(
            data=self.make_event_data('hello.world', 'hello.co'),
            group=self.create_group(
                project=self.project,
                message='event4',
            ),
            message='event4',
        )
        event5 = self.create_event(
            data=self.make_event_data('hello.py', 'hello.co'),
            group=self.create_group(
                project=self.project,
                message='event5',
            ),
            message='event5',
        )
        event6 = self.create_event(
            data=self.make_event_data('hello.cpp'),
            group=self.create_group(
                project=self.project,
                message='event6'),
            message='event6',
        )

        all_events = set([event1, event2, event3, event4, event5, event6])

        rule = self.project.rule_set.all()[0]
        digest = build_digest(
            self.project,
            [
                event_to_record(event1, (rule,)),
                event_to_record(event2, (rule,)),
                event_to_record(event3, (rule,)),
                event_to_record(event4, (rule,)),
                event_to_record(event5, (rule,)),
                event_to_record(event6, (rule,)),
            ]
        )

        with self.tasks():
            self.plugin.notify_digest(self.project, digest)

        users = [self.user1, self.user2, self.user3, self.user4, self.user5, self.user6, self.user7]
        expected_emails = sorted([u.email for u in users])
        emails = sorted(mail.outbox, key=lambda e: e.to[0])
        assert expected_emails == sorted([e.to[0] for e in mail.outbox])

        expected = [set([event2, event3, event4, event5]), set([event3, event2, event5]), set([event2, event3, event5]),
                    set([event2, event3, event4, event5]), set([event3, event4, event5]), set([event3, event4, event5]), set([event6])]

        for user_email, email, events in zip(expected_emails, emails, expected):
            event_messages = [e.message for e in events]
            not_event_messages = [e.message for e in (all_events - events)]
            self.assert_digest_email(
                email=email,
                user_email=user_email,
                event_messages=event_messages,
                not_event_messages=not_event_messages,
            )

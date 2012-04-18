# coding: utf-8

from __future__ import absolute_import


from django.core import mail
from django.contrib.auth.models import User
from sentry.models import Project, ProjectKey, Group, Event, Team, \
  MessageFilterValue, MessageCountByMinute, FilterValue, PendingTeamMember

from tests.base import TestCase


class ProjectTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.project = Project.objects.get(id=1)

    def test_migrate(self):
        project2 = Project.objects.create(name='Test')
        self.project.merge_to(project2)

        self.assertFalse(Project.objects.filter(pk=1).exists())
        self.assertFalse(Group.objects.filter(project__isnull=True).exists())
        self.assertFalse(Event.objects.filter(project__isnull=True).exists())
        self.assertFalse(MessageFilterValue.objects.filter(project__isnull=True).exists())
        self.assertFalse(MessageCountByMinute.objects.filter(project__isnull=True).exists())
        self.assertFalse(FilterValue.objects.filter(project__isnull=True).exists())

        self.assertEquals(project2.group_set.count(), 4)
        self.assertEquals(project2.event_set.count(), 10)
        self.assertEquals(project2.messagefiltervalue_set.count(), 0)
        self.assertEquals(project2.messagecountbyminute_set.count(), 0)
        self.assertEquals(project2.filtervalue_set.count(), 0)


class ProjectKeyTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def test_get_dsn(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            self.assertEquals(key.get_dsn(), 'http://public:secret@example.com/1')

    def test_get_dsn_with_ssl(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.Settings(SENTRY_URL_PREFIX='https://example.com'):
            self.assertEquals(key.get_dsn(), 'https://public:secret@example.com/1')

    def test_get_dsn_with_port(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.Settings(SENTRY_URL_PREFIX='http://example.com:81'):
            self.assertEquals(key.get_dsn(), 'http://public:secret@example.com:81/1')

    def test_key_is_created_for_project_with_existing_team(self):
        user = User.objects.create(username='admin')
        team = Team.objects.create(name='Test', slug='test', owner=user)
        project = Project.objects.create(name='Test', slug='test', owner=user, team=team)
        self.assertTrue(project.key_set.filter(user=user).exists())

    def test_key_is_created_for_project_with_new_team(self):
        user = User.objects.create(username='admin')
        project = Project.objects.create(name='Test', slug='test', owner=user)
        self.assertTrue(project.key_set.filter(user=user).exists())


class PendingTeamMemberTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def test_token_generation(self):
        member = PendingTeamMember(id=1, team_id=1, email='foo@example.com')
        with self.Settings(SENTRY_KEY='a'):
            self.assertEquals(member.token, 'f3f2aa3e57f4b936dfd4f42c38db003e')

    def test_token_generation_unicode_key(self):
        member = PendingTeamMember(id=1, team_id=1, email='foo@example.com')
        with self.Settings(SENTRY_KEY="\xfc]C\x8a\xd2\x93\x04\x00\x81\xeak\x94\x02H\x1d\xcc&P'q\x12\xa2\xc0\xf2v\x7f\xbb*lX"):
            self.assertEquals(member.token, 'df41d9dfd4ba25d745321e654e15b5d0')

    def test_send_invite_email(self):
        team = Team(name='test', slug='test', id=1)
        member = PendingTeamMember(id=1, team=team, email='foo@example.com')
        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            member.send_invite_email()

            self.assertEquals(len(mail.outbox), 1)

            msg = mail.outbox[0]

            self.assertEquals(msg.to, ['foo@example.com'])

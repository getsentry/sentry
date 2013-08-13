# coding: utf-8

from __future__ import absolute_import


import mock
from datetime import timedelta
from django.conf import settings
from django.core import mail
from django.core.urlresolvers import reverse
from django.utils import timezone
from sentry.constants import MINUTE_NORMALIZATION
from sentry.models import (
    Project, ProjectKey, Group, Event, Team,
    GroupTag, GroupCountByMinute, TagValue, PendingTeamMember,
    LostPasswordHash, Alert, User, create_default_project)
from sentry.testutils import TestCase, fixture


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
        self.assertFalse(GroupTag.objects.filter(project__isnull=True).exists())
        self.assertFalse(GroupCountByMinute.objects.filter(project__isnull=True).exists())
        self.assertFalse(TagValue.objects.filter(project__isnull=True).exists())

        self.assertEquals(project2.group_set.count(), 4)
        self.assertEquals(project2.event_set.count(), 10)
        assert not project2.grouptag_set.exists()
        assert not project2.groupcountbyminute_set.exists()
        assert not TagValue.objects.filter(project=project2).exists()


class ProjectKeyTest(TestCase):
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

    def test_get_dsn_with_public_endpoint_setting(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.Settings(SENTRY_PUBLIC_ENDPOINT='http://public_endpoint.com'):
            self.assertEquals(key.get_dsn(public=True), 'http://public@public_endpoint.com/1')

    def test_get_dsn_with_endpoint_setting(self):
        key = ProjectKey(project_id=1, public_key='public', secret_key='secret')
        with self.Settings(SENTRY_ENDPOINT='http://endpoint.com'):
            self.assertEquals(key.get_dsn(), 'http://public:secret@endpoint.com/1')

    def test_key_is_created_for_project_with_existing_team(self):
        user = User.objects.create(username='admin')
        team = Team.objects.create(name='Test', slug='test', owner=user)
        project = Project.objects.create(name='Test', slug='test', owner=user, team=team)
        assert project.key_set.filter(user__isnull=True).exists() is True

    def test_key_is_created_for_project_with_new_team(self):
        user = User.objects.create(username='admin')
        project = Project.objects.create(name='Test', slug='test', owner=user)
        assert project.key_set.filter(user__isnull=True).exists() is True


class PendingTeamMemberTest(TestCase):
    def test_token_generation(self):
        member = PendingTeamMember(id=1, team_id=1, email='foo@example.com')
        with self.Settings(SECRET_KEY='a'):
            self.assertEquals(member.token, 'f3f2aa3e57f4b936dfd4f42c38db003e')

    def test_token_generation_unicode_key(self):
        member = PendingTeamMember(id=1, team_id=1, email='foo@example.com')
        with self.Settings(SECRET_KEY="\xfc]C\x8a\xd2\x93\x04\x00\x81\xeak\x94\x02H\x1d\xcc&P'q\x12\xa2\xc0\xf2v\x7f\xbb*lX"):
            self.assertEquals(member.token, 'df41d9dfd4ba25d745321e654e15b5d0')

    def test_send_invite_email(self):
        team = Team(name='test', slug='test', id=1)
        member = PendingTeamMember(id=1, team=team, email='foo@example.com')
        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            member.send_invite_email()

            self.assertEquals(len(mail.outbox), 1)

            msg = mail.outbox[0]

            self.assertEquals(msg.to, ['foo@example.com'])


class LostPasswordTest(TestCase):
    @fixture
    def password_hash(self):
        return LostPasswordHash.objects.create(
            user=self.user,
        )

    def test_send_recover_mail(self):
        with self.Settings(SENTRY_URL_PREFIX='http://testserver'):
            self.password_hash.send_recover_mail()
            assert len(mail.outbox) == 1
            msg = mail.outbox[0]
            assert msg.to == [self.user.email]
            assert msg.subject == '[Sentry] Password Recovery'
            url = 'http://testserver' + reverse('sentry-account-recover-confirm',
                args=[self.password_hash.user_id, self.password_hash.hash])
            assert url in msg.body


class AlertTest(TestCase):
    @fixture
    def params(self):
        return {
            'project_id': self.project.id,
            'message': 'This is a test message',
        }

    @mock.patch('sentry.models.has_trending', mock.Mock(return_value=True))
    @mock.patch('sentry.models.Group.objects.get_accelerated')
    def test_does_add_trending_events(self, get_accelerated):
        get_accelerated.return_value = [self.group]
        alert = Alert.maybe_alert(**self.params)
        get_accelerated.assert_called_once_with([self.project.id], minutes=MINUTE_NORMALIZATION)
        assert list(alert.related_groups.all()) == [self.group]


class GroupIsOverResolveAgeTest(TestCase):
    def test_simple(self):
        group = self.group
        group.last_seen = timezone.now() - timedelta(hours=2)
        group.project.update_option('sentry:resolve_age', 1)  # 1 hour
        assert group.is_over_resolve_age() is True
        group.last_seen = timezone.now()
        assert group.is_over_resolve_age() is False


class CreateDefaultProjectTest(TestCase):
    def test_simple(self):
        user, _ = User.objects.get_or_create(is_superuser=True, defaults={
            'username': 'test'
        })
        Team.objects.filter(project__id=settings.SENTRY_PROJECT).delete()
        Project.objects.filter(id=settings.SENTRY_PROJECT).delete()

        create_default_project(created_models=[Project])

        project = Project.objects.filter(id=settings.SENTRY_PROJECT)
        assert project.exists() is True
        project = project.get()
        assert project.owner == user
        assert project.public is False
        assert project.name == 'Sentry (Internal)'
        assert project.slug == 'sentry'
        team = project.team
        assert team.owner == user
        assert team.slug == 'sentry'

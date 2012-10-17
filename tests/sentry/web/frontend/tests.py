# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging
import json

from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.conf import settings
from sentry.constants import MEMBER_OWNER, MEMBER_USER
from sentry.models import Group, Project, TeamMember, Team
from sentry.web.helpers import get_login_url

from tests.base import TestCase

logger = logging.getLogger(__name__)


class SentryViewsTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()

    def test_auth(self):
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/login.html')

        resp = self.client.post(reverse('sentry-login'), {
            'username': 'admin',
            'password': 'admin',
        }, follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateNotUsed(resp, 'sentry/login.html')

    def test_dashboard(self):
        # no projects redirects them to create new project
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/projects/new.html')

        # requires at least one project to show dashboard
        Project.objects.create(name='foo', owner=self.user)
        Project.objects.create(name='bar', owner=self.user).team
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/dashboard.html')

        # no projects and unauthenticated
        self.client.logout()
        Project.objects.all().delete()
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/login.html')

    def test_index(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry', kwargs={'project_id': 1}) + '?sort=freq', follow=False)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')

    def test_group_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group', kwargs={'project_id': 1, 'group_id': 2}), follow=False)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/details.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_event_list(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-events', kwargs={'project_id': 1, 'group_id': 2}), follow=False)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event_list.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_message_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-event', kwargs={'project_id': 1, 'group_id': 2, 'event_id': 4}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_json_multi(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}))
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/json')
        self.assertEquals(json.loads(resp.content)[0]['level'], 'error')
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}), {'limit': 1})
        self.assertEquals(resp.status_code, 200)
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}), {'limit': settings.MAX_JSON_RESULTS + 1})
        self.assertEquals(resp.status_code, 400)

    def test_group_events_details_json(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-event-json', kwargs={'project_id': 1, 'group_id': 2, 'event_id_or_latest': 'latest'}))
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/json')
        self.assertEquals(json.loads(resp.content)['level'], 'error')

    def test_status_env(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-admin-status'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/env.html')

    def test_status_packages(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-admin-packages-status'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/packages.html')

    def test_status_queue(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-admin-queue-status'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/queue.html')

    def test_stats(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-admin-stats'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/stats.html')

    def test_manage_users(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-admin-users'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/users/list.html')

    def test_event_list(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-events', kwargs={'project_id': 1}))
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/events/event_list.html')

    def test_replay_event(self):
        # bad event_id
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-replay', kwargs={'project_id': 1, 'event_id': 1}))
        self.assertEquals(resp.status_code, 302)

        # valid params
        # self.client.login(username='admin', password='admin')
        # resp = self.client.get(reverse('sentry-replay', kwargs={'project_id': 1, 'event_id': 4}))
        # self.assertEquals(resp.status_code, 200)
        # self.assertTemplateUsed(resp, 'sentry/events/replay.html')


class PermissionBase(TestCase):
    """
    These tests simply ensure permission requirements for various views.
    """
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()
        self.user2 = User(username="member", email="member@localhost")
        self.user2.set_password('member')
        self.user2.save()
        self.user3 = User(username="nobody", email="nobody@localhost")
        self.user3.set_password('nobody')
        self.user3.save()
        self.user4 = User(username="owner", email="owner@localhost")
        self.user4.set_password('owner')
        self.user4.save()
        self.team = Team.objects.create(owner=self.user4, name='foo', slug='foo')
        self.project = Project.objects.get(id=1)
        self.project.update(public=False, team=self.team)
        self.tm = TeamMember.objects.get_or_create(
            user=self.user2,
            team=self.team,
            type=MEMBER_USER,
        )[0]
        TeamMember.objects.get_or_create(
            user=self.user4,
            team=self.team,
            type=MEMBER_OWNER,
        )[0]

    def _assertPerm(self, path, template, account=None, want=True):
        """
        Requests ``path`` and asserts that ``template`` is
        rendered for ``account`` (Anonymous if None) given ``want``
        is Trueish.
        """
        if account:
            self.assertTrue(self.client.login(username=account, password=account))
        else:
            self.client.logout()
        resp = self.client.get(path)
        if want:
            self.assertEquals(resp.status_code, 200)
            self.assertTemplateUsed(resp, template)
        else:
            self.assertEquals(resp.status_code, 302)
            self.assertTemplateNotUsed(resp, template)


class ProjectListTest(PermissionBase):
    path = reverse('sentry-project-list')
    template = 'sentry/projects/list.html'

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, 'admin')

    def test_user_can_load(self):
        self._assertPerm(self.path, self.template, 'nobody')

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)


class NewProjectTest(PermissionBase):
    path = reverse('sentry-new-project')
    template = 'sentry/projects/new.html'

    def test_admin_can_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=False, SENTRY_ALLOW_TEAM_CREATION=False):
            self._assertPerm(self.path, self.template, 'admin')

    def test_user_cannot_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=False, SENTRY_ALLOW_TEAM_CREATION=False):
            self._assertPerm(self.path, self.template, 'nobody', False)

    def test_anonymous_cannot_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=False, SENTRY_ALLOW_TEAM_CREATION=False):
            self._assertPerm(self.path, self.template, None, False)

    def test_public_creation_admin_can_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True, SENTRY_ALLOW_TEAM_CREATION=True):
            self._assertPerm(self.path, self.template, 'admin')

    def test_public_creation_user_can_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True, SENTRY_ALLOW_TEAM_CREATION=True):
            self._assertPerm(self.path, self.template, 'nobody')

    def test_public_anonymous_cannot_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True, SENTRY_ALLOW_TEAM_CREATION=True):
            self._assertPerm(self.path, self.template, None, False)


class ManageProjectTest(PermissionBase):
    path = reverse('sentry-manage-project', kwargs={'project_id': 1})
    template = 'sentry/projects/manage.html'

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, 'admin')

    def test_owner_can_load(self):
        self._assertPerm(self.path, self.template, 'owner')

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        self._assertPerm(self.path, self.template, 'nobody', False)

    def test_member_cannot_load(self):
        self._assertPerm(self.path, self.template, 'member', False)


class RemoveProjectTest(PermissionBase):
    path = reverse('sentry-remove-project', kwargs={'project_id': 1})
    template = 'sentry/projects/remove.html'

    def test_admin_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, 'admin', False)

    def test_owner_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, 'owner', False)

    def test_anonymous_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, 'nobody', False)

    def test_member_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, 'member', False)

    def test_admin_can_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, 'admin')

    def test_owner_can_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, 'owner')

    def test_anonymous_cannot_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, 'nobody', False)

    def test_member_cannot_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, 'member', False)


class NewTeamMemberTest(PermissionBase):
    template = 'sentry/teams/members/new.html'

    def setUp(self):
        super(NewTeamMemberTest, self).setUp()
        self.path = reverse('sentry-new-team-member', kwargs={'team_slug': self.team.slug})

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, 'admin')

    def test_owner_can_load(self):
        self._assertPerm(self.path, self.template, 'owner')

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        self._assertPerm(self.path, self.template, 'nobody', False)

    def test_member_cannot_load(self):
        self._assertPerm(self.path, self.template, 'member', False)


class EditTeamMemberTest(PermissionBase):
    template = 'sentry/teams/members/edit.html'

    def setUp(self):
        super(EditTeamMemberTest, self).setUp()
        self.path = reverse('sentry-edit-team-member', kwargs={'team_slug': self.team.slug, 'member_id': self.tm.pk})

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, 'admin')

    def test_owner_can_load(self):
        self._assertPerm(self.path, self.template, 'owner')

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        self._assertPerm(self.path, self.template, 'nobody', False)

    def test_member_cannot_load(self):
        self._assertPerm(self.path, self.template, 'member', False)


class RemoveTeamMemberTest(PermissionBase):
    template = 'sentry/teams/members/remove.html'

    def setUp(self):
        super(RemoveTeamMemberTest, self).setUp()
        self.path = reverse('sentry-remove-team-member', kwargs={'team_slug': self.team.slug, 'member_id': self.tm.pk})

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, 'admin')

    def test_owner_can_load(self):
        self._assertPerm(self.path, self.template, 'owner')

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        self._assertPerm(self.path, self.template, 'nobody', False)

    def test_member_cannot_load(self):
        self._assertPerm(self.path, self.template, 'member', False)


class SentrySearchTest(TestCase):
    def test_checksum_query(self):
        checksum = 'a' * 32
        g = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )

        with self.Settings(SENTRY_PUBLIC=True):
            response = self.client.get(reverse('sentry-search', kwargs={'project_id': 1}), {'q': '%s$%s' % (checksum, checksum)})
            self.assertEquals(response.status_code, 302)
            self.assertEquals(response['Location'], 'http://testserver%s' % (g.get_absolute_url(),))

    def test_dupe_checksum(self):
        checksum = 'a' * 32
        g1 = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )
        g2 = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='b',
            checksum=checksum,
            message='hi',
        )

        with self.Settings(SENTRY_PUBLIC=True, SENTRY_USE_SEARCH=False):
            response = self.client.get(reverse('sentry-search', kwargs={'project_id': 1}), {'q': '%s$%s' % (checksum, checksum)})
            self.assertEquals(response.status_code, 200)
            self.assertTemplateUsed(response, 'sentry/search.html')
            context = response.context
            self.assertTrue('event_list' in context)
            self.assertEquals(len(context['event_list']), 2)
            self.assertTrue(g1 in context['event_list'])
            self.assertTrue(g2 in context['event_list'])


class SentryHelpersTest(TestCase):
    def test_get_db_engine(self):
        from sentry.utils.db import get_db_engine
        _databases = getattr(django_settings, 'DATABASES', {}).copy()

        django_settings.DATABASES['default'] = {'ENGINE': 'blah.sqlite3'}

        self.assertEquals(get_db_engine(), 'sqlite3')

        django_settings.DATABASES['default'] = {'ENGINE': 'blah.mysql'}

        self.assertEquals(get_db_engine(), 'mysql')

        django_settings.DATABASES = _databases

    def test_get_login_url(self):
        with self.Settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

        with self.Settings(LOGIN_URL=reverse('sentry-fake-login')):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-fake-login'))

        # should still be cached
        with self.Settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(False)
            self.assertEquals(url, reverse('sentry-fake-login'))

        with self.Settings(SENTRY_LOGIN_URL=None):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

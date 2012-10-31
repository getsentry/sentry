# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging
import json

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.conf import settings
from sentry.constants import MEMBER_USER
from sentry.models import Group, Project, TeamMember, Team
from sentry.testutils import fixture

from tests.base import TestCase

logger = logging.getLogger(__name__)


class SentryViewsTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    @fixture
    def user(self):
        user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        user.set_password('password')
        user.save()
        return user

    def test_dashboard(self):
        # no projects redirects them to create new project
        self.client.login(username=self.user.username, password='password')
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
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry', kwargs={'project_id': 1}) + '?sort=freq', follow=False)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')

    def test_group_details(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-group', kwargs={'project_id': 1, 'group_id': 2}), follow=False)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/details.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_event_list(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-group-events', kwargs={'project_id': 1, 'group_id': 2}), follow=False)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event_list.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_message_details(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-group-event', kwargs={'project_id': 1, 'group_id': 2, 'event_id': 4}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_json_multi(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}))
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/json')
        self.assertEquals(json.loads(resp.content)[0]['level'], 'error')
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}), {'limit': 1})
        self.assertEquals(resp.status_code, 200)
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}), {'limit': settings.MAX_JSON_RESULTS + 1})
        self.assertEquals(resp.status_code, 400)

    def test_group_events_details_json(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-group-event-json', kwargs={'project_id': 1, 'group_id': 2, 'event_id_or_latest': 'latest'}))
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/json')
        self.assertEquals(json.loads(resp.content)['level'], 'error')

    def test_status_env(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-admin-status'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/env.html')

    def test_status_packages(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-admin-packages-status'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/packages.html')

    def test_status_queue(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-admin-queue-status'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/queue.html')

    def test_stats(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-admin-stats'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/stats.html')

    def test_manage_users(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-admin-users'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/users/list.html')

    def test_event_list(self):
        self.client.login(username=self.user.username, password='password')
        resp = self.client.get(reverse('sentry-events', kwargs={'project_id': 1}))
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/events/event_list.html')

    def test_replay_event(self):
        # bad event_id
        self.client.login(username=self.user.username, password='password')
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

    @fixture
    def admin(self):
        user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        user.set_password('admin')
        user.save()
        return user

    @fixture
    def member(self):
        user = User(username="member", email="member@localhost")
        user.set_password('member')
        user.save()

        TeamMember.objects.create(
            user=user,
            team=self.team,
            type=MEMBER_USER,
        )
        return user

    @fixture
    def nobody(self):
        user = User(username="nobody", email="nobody@localhost")
        user.set_password('nobody')
        user.save()
        return user

    @fixture
    def owner(self):
        user = User(username="owner", email="owner@localhost")
        user.set_password('owner')
        user.save()

        Team.objects.create(owner=user, name='foo', slug='foo')

        return user

    @fixture
    def tm(self):
        return TeamMember.objects.get(user=self.member, team=self.team)

    @fixture
    def team(self):
        return Team.objects.get(owner=self.owner, slug='foo')

    @fixture
    def project(self):
        project = Project.objects.get(id=1)
        project.update(public=False, team=self.team)
        return project

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
    template = 'sentry/projects/list.html'

    @fixture
    def path(self):
        return reverse('sentry-project-list')

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, self.admin.username)

    def test_user_can_load(self):
        self._assertPerm(self.path, self.template, self.nobody.username)

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)


class NewProjectTest(PermissionBase):
    template = 'sentry/projects/new.html'

    @fixture
    def path(self):
        return reverse('sentry-new-project')

    def test_admin_can_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=False, SENTRY_ALLOW_TEAM_CREATION=False):
            self._assertPerm(self.path, self.template, self.admin.username)

    def test_user_cannot_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=False, SENTRY_ALLOW_TEAM_CREATION=False):
            self._assertPerm(self.path, self.template, self.nobody.username, False)

    def test_anonymous_cannot_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=False, SENTRY_ALLOW_TEAM_CREATION=False):
            self._assertPerm(self.path, self.template, None, False)

    def test_public_creation_admin_can_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True, SENTRY_ALLOW_TEAM_CREATION=True):
            self._assertPerm(self.path, self.template, self.admin.username)

    def test_public_creation_user_can_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True, SENTRY_ALLOW_TEAM_CREATION=True):
            self._assertPerm(self.path, self.template, self.nobody.username)

    def test_public_anonymous_cannot_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True, SENTRY_ALLOW_TEAM_CREATION=True):
            self._assertPerm(self.path, self.template, None, False)


class ManageProjectTest(PermissionBase):
    template = 'sentry/projects/manage.html'

    @fixture
    def path(self):
        return reverse('sentry-manage-project', kwargs={'project_id': self.project.id})

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, self.admin.username)

    def test_owner_can_load(self):
        self._assertPerm(self.path, self.template, self.owner.username)

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        self._assertPerm(self.path, self.template, self.nobody.username, False)

    def test_member_cannot_load(self):
        self._assertPerm(self.path, self.template, self.member.username, False)


class RemoveProjectTest(PermissionBase):
    template = 'sentry/projects/remove.html'

    @fixture
    def path(self):
        return reverse('sentry-remove-project', kwargs={'project_id': self.project.id})

    def test_admin_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, self.admin.username, False)

    def test_owner_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, self.owner.username, False)

    def test_anonymous_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, self.nobody.username, False)

    def test_member_cannot_remove_default(self):
        with self.Settings(SENTRY_PROJECT=1):
            self._assertPerm(self.path, self.template, self.member.username, False)

    def test_admin_can_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, self.admin.username)

    def test_owner_can_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, self.owner.username)

    def test_anonymous_cannot_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, self.nobody.username, False)

    def test_member_cannot_load(self):
        with self.Settings(SENTRY_PROJECT=2):
            self._assertPerm(self.path, self.template, self.member.username, False)


class NewTeamMemberTest(PermissionBase):
    template = 'sentry/teams/members/new.html'

    @fixture
    def path(self):
        return reverse('sentry-new-team-member', kwargs={'team_slug': self.team.slug})

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, self.admin.username)

    def test_owner_can_load(self):
        self._assertPerm(self.path, self.template, self.owner.username)

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        self._assertPerm(self.path, self.template, self.nobody.username, False)

    def test_member_cannot_load(self):
        self._assertPerm(self.path, self.template, self.member.username, False)


class EditTeamMemberTest(PermissionBase):
    template = 'sentry/teams/members/edit.html'

    @fixture
    def path(self):
        return reverse('sentry-edit-team-member', kwargs={'team_slug': self.team.slug, 'member_id': self.tm.pk})

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, self.admin.username)

    def test_owner_can_load(self):
        self._assertPerm(self.path, self.template, self.owner.username)

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        self._assertPerm(self.path, self.template, self.nobody.username, False)

    def test_member_cannot_load(self):
        self._assertPerm(self.path, self.template, self.member.username, False)


class RemoveTeamMemberTest(PermissionBase):
    template = 'sentry/teams/members/remove.html'

    @fixture
    def path(self):
        return reverse('sentry-remove-team-member', kwargs={'team_slug': self.team.slug, 'member_id': self.tm.pk})

    def test_admin_can_load(self):
        self._assertPerm(self.path, self.template, self.admin.username)

    def test_owner_can_load(self):
        self._assertPerm(self.path, self.template, self.owner.username)

    def test_anonymous_cannot_load(self):
        self._assertPerm(self.path, self.template, None, False)

    def test_user_cannot_load(self):
        self._assertPerm(self.path, self.template, self.nobody.username, False)

    def test_member_cannot_load(self):
        self._assertPerm(self.path, self.template, self.member.username, False)


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

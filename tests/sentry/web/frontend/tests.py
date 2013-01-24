# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging
import json

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.conf import settings
from sentry.constants import MEMBER_USER
from sentry.models import Group, Project, TeamMember, Team
from sentry.testutils import TestCase, fixture, before

logger = logging.getLogger(__name__)


class BaseViewTest(TestCase):
    def login(self):
        self.login_as(self.user)


class DashboardTest(BaseViewTest):
    @fixture
    def path(self):
        return reverse('sentry')

    def test_redirects_to_new_project_when_no_projects(self):
        self.login()

        resp = self.client.get(self.path, follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/projects/new.html')

    def test_shows_dashboard_with_a_project(self):
        self.login()

        Project.objects.create(name='foo', owner=self.user)
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/dashboard.html')

    def test_requires_authentication(self):
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/login.html')


class EnvStatusTest(BaseViewTest):
    @fixture
    def path(self):
        return reverse('sentry-admin-status')

    def test_requires_auth(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 302)

    def test_renders_template(self):
        self.login()

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/env.html')


class PackageStatusTest(BaseViewTest):
    @fixture
    def path(self):
        return reverse('sentry-admin-packages-status')

    def test_requires_auth(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 302)

    def test_renders_template(self):
        self.login()

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/packages.html')


class MailStatusTest(BaseViewTest):
    @fixture
    def path(self):
        return reverse('sentry-admin-mail-status')

    def test_requires_auth(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 302)

    def test_renders_template(self):
        self.login()

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/status/mail.html')


class StatsTest(BaseViewTest):
    @fixture
    def path(self):
        return reverse('sentry-admin-stats')

    def test_requires_auth(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 302)

    def test_renders_template(self):
        self.login()

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/stats.html')


class SentryViewsTest(BaseViewTest):
    fixtures = ['tests/fixtures/views.json']

    @before
    def login_user(self):
        self.login_as(self.user)

    def test_stream_loads(self):
        resp = self.client.get(reverse('sentry-stream', kwargs={'project_id': 1}))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')

    def test_group_details(self):
        resp = self.client.get(reverse('sentry-group', kwargs={'project_id': 1, 'group_id': 2}))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/details.html')
        assert 'group' in resp.context
        assert 'project' in resp.context
        assert resp.context['group'].id == 2
        assert resp.context['project'].id == 1

    def test_group_event_list(self):
        resp = self.client.get(reverse('sentry-group-events', kwargs={'project_id': 1, 'group_id': 2}))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/event_list.html')
        assert 'group' in resp.context
        assert 'project' in resp.context
        assert 'event_list' in resp.context
        assert resp.context['group'].id == 2
        assert resp.context['project'].id == 1

    def test_group_tag_list(self):
        resp = self.client.get(reverse('sentry-group-tags', kwargs={'project_id': 1, 'group_id': 2}))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/tag_list.html')
        assert 'group' in resp.context
        assert 'project' in resp.context
        assert 'tag_list' in resp.context
        assert resp.context['group'].id == 2
        assert resp.context['project'].id == 1

    def test_group_message_details(self):
        resp = self.client.get(reverse('sentry-group-event', kwargs={'project_id': 1, 'group_id': 2, 'event_id': 4}))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/event.html')
        assert 'group' in resp.context
        assert 'project' in resp.context
        assert 'event' in resp.context
        assert resp.context['group'].id == 2
        assert resp.context['project'].id == 1
        assert resp.context['event'].id == 4

    def test_group_json_multi(self):
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}))
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/json')
        self.assertEquals(json.loads(resp.content)[0]['level'], 'error')
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}), {'limit': 1})
        self.assertEquals(resp.status_code, 200)
        resp = self.client.get(reverse('sentry-group-events-json', kwargs={'project_id': 1, 'group_id': 2}), {'limit': settings.MAX_JSON_RESULTS + 1})
        self.assertEquals(resp.status_code, 400)

    def test_group_events_details_json(self):
        resp = self.client.get(reverse('sentry-group-event-json', kwargs={'project_id': 1, 'group_id': 2, 'event_id_or_latest': 'latest'}))
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/json')
        self.assertEquals(json.loads(resp.content)['level'], 'error')

    def test_manage_users(self):
        resp = self.client.get(reverse('sentry-admin-users'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/admin/users/list.html')

    def test_event_list(self):
        resp = self.client.get(reverse('sentry-events', kwargs={'project_id': self.project.id}))
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/events/event_list.html')

    def test_replay_event(self):
        # bad event_id
        resp = self.client.get(reverse('sentry-replay', kwargs={'project_id': self.project.id, 'event_id': 1}))
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
    @before
    def login_user(self):
        self.login_as(self.user)

    @fixture
    def path(self):
        return reverse('sentry-search', kwargs={'project_id': self.project.id})

    def test_checksum_query(self):
        checksum = 'a' * 32
        g = Group.objects.create(
            project=self.project,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )

        response = self.client.get(self.path, {'q': '%s$%s' % (checksum, checksum)})
        self.assertEquals(response.status_code, 302)
        self.assertEquals(response['Location'], 'http://testserver%s' % (g.get_absolute_url(),))

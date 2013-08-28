# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.constants import MEMBER_USER
from sentry.models import Group, Project, TeamMember, Team, User
from sentry.testutils import TestCase, fixture, before


class EnvStatusTest(TestCase):
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


class PackageStatusTest(TestCase):
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


class MailStatusTest(TestCase):
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


class StatsTest(TestCase):
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


class ManageUsersTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-admin-users')

    def test_does_render(self):
        self.login()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/admin/users/list.html')


class ReplayTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-replay', kwargs={
            'team_slug': self.team.slug,
            'project_id': self.project.slug,
            'group_id': self.group.id,
            'event_id': self.event.id,
        })

    def test_does_render(self):
        self.login()
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/events/replay_request.html')


class PermissionBase(TestCase):
    """
    These tests simply ensure permission requirements for various views.
    """
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


class NewTeamProjectTest(PermissionBase):
    template = 'sentry/teams/projects/new.html'

    @fixture
    def path(self):
        return reverse('sentry-new-project', args=[self.team.slug])

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

    def test_public_anonymous_cannot_load(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True, SENTRY_ALLOW_TEAM_CREATION=True):
            self._assertPerm(self.path, self.template, None, False)


class ManageProjectTest(PermissionBase):
    template = 'sentry/projects/manage.html'

    @fixture
    def path(self):
        return reverse('sentry-manage-project', kwargs={'team_slug': self.team.slug, 'project_id': self.project.id})

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
        return reverse('sentry-remove-project', kwargs={'team_slug': self.team.slug, 'project_id': self.project.id})

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
        return reverse('sentry-search', kwargs={'team_slug': self.team.slug, 'project_id': self.project.id})

    def test_checksum_query(self):
        checksum = 'a' * 32
        group = Group.objects.create(
            project=self.project,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )

        response = self.client.get(self.path, {'q': '%s$%s' % (checksum, checksum)})
        self.assertEquals(response.status_code, 302)
        self.assertEquals(response['Location'], 'http://testserver%s' % (reverse('sentry-group', kwargs={
            'project_id': group.project.slug,
            'team_slug': group.team.slug,
            'group_id': group.id,
        }),))

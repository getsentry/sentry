# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse

from sentry.constants import MEMBER_OWNER, MEMBER_USER
from sentry.models import (
    Team, TeamMember, PendingTeamMember, AccessGroup, Project, User)
from sentry.testutils import TestCase, fixture, before


class BaseTeamTest(TestCase):
    @fixture
    def user2(self):
        user = User.objects.create(username="other", email="other@localhost")
        self.team.member_set.create(user=user, type=MEMBER_USER)
        return user

    @fixture
    def tm(self):
        return self.team.member_set.get(user=self.user, type=MEMBER_OWNER)

    @fixture
    def tm2(self):
        return self.team.member_set.get(user=self.user2)

    @before
    def login_user(self):
        self.login_as(self.user)


class NewTeamTest(BaseTeamTest):
    @fixture
    def path(self):
        return reverse('sentry-new-team')

    @mock.patch('sentry.web.frontend.teams.can_create_teams', mock.Mock(return_value=False))
    def test_missing_permission(self):
        resp = self.client.post(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/generic_error.html')

    @mock.patch('sentry.web.frontend.teams.can_create_teams', mock.Mock(return_value=True))
    def test_missing_params(self):
        resp = self.client.post(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/teams/new.html')

    @mock.patch('sentry.web.frontend.teams.can_create_teams', mock.Mock(return_value=True))
    @mock.patch('django.contrib.auth.models.User.has_perm', mock.Mock(return_value=False))
    def test_valid_params(self):
        resp = self.client.post(self.path, {
            'name': 'Test Team',
            'slug': 'test-team',
            'owner': self.user.username,
        })
        self.assertEquals(resp.status_code, 302)
        path = reverse('sentry-new-project', args=['test-team'])
        self.assertEquals(resp['Location'], 'http://testserver%s' % (path,))

        team = Team.objects.filter(name='Test Team')
        self.assertTrue(team.exists())
        team = team.get()

        self.assertEquals(team.owner, self.user)

        member_set = list(team.member_set.all())

        self.assertEquals(len(member_set), 1)
        member = member_set[0]
        self.assertEquals(member.user, self.user)
        self.assertEquals(member.type, MEMBER_OWNER)

    @mock.patch('sentry.web.frontend.teams.can_create_teams', mock.Mock(return_value=True))
    @mock.patch('django.contrib.auth.models.User.has_perm', mock.Mock(return_value=True))
    def test_superuser_can_set_owner(self):
        resp = self.client.post(self.path, {
            'name': 'Test Team',
            'slug': 'test',
            'owner': self.user2.username,
        })
        self.assertNotEquals(resp.status_code, 200)

        team = Team.objects.get(name='Test Team')
        self.assertEquals(team.owner, self.user2)

        member_set = list(team.member_set.all())

        self.assertEquals(len(member_set), 1)
        member = member_set[0]
        self.assertEquals(member.user, self.user2)
        self.assertEquals(member.type, MEMBER_OWNER)


class ManageTeamTest(BaseTeamTest):
    @fixture
    def path(self):
        return reverse('sentry-manage-team', args=[self.team.slug])

    def test_renders_with_context(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/teams/manage.html')
        assert resp.context['team'] == self.team

    @mock.patch('django.contrib.auth.models.User.has_perm', mock.Mock(return_value=False))
    def test_valid_params(self):
        resp = self.client.post(self.path, {
            'name': 'bar',
            'slug': self.team.slug,
            'owner': self.team.owner.username,
        })
        assert resp.status_code == 302
        self.assertEquals(resp['Location'], 'http://testserver' + self.path)
        team = Team.objects.get(pk=self.team.pk)
        self.assertEquals(team.name, 'bar')

    @mock.patch('django.contrib.auth.models.User.has_perm', mock.Mock(return_value=True))
    def test_superuser_can_set_owner(self):
        resp = self.client.post(self.path, {
            'name': self.team.name,
            'slug': self.team.slug,
            'owner': self.user2.username,
        })
        assert resp.status_code == 302

        team = Team.objects.get(id=self.team.id)

        assert team.owner == self.user2

        members = [(t.user, t.type) for t in self.team.member_set.all()]

        assert (self.user2, MEMBER_OWNER) in members
        assert (self.user, MEMBER_OWNER) in members


class RemoveTeamTest(BaseTeamTest):
    @fixture
    def path(self):
        return reverse('sentry-remove-team', args=[self.team.slug])

    @mock.patch('sentry.web.frontend.teams.can_remove_team', mock.Mock(return_value=False))
    def test_missing_permission(self):
        resp = self.client.post(self.path)
        self.assertEquals(resp.status_code, 302)
        self.assertEquals(resp['Location'], 'http://testserver' + reverse('sentry'))

    @mock.patch('sentry.web.frontend.teams.can_remove_team', mock.Mock(return_value=True))
    def test_loads(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/teams/remove.html')

    @mock.patch('sentry.web.frontend.teams.can_remove_team', mock.Mock(return_value=True))
    def test_valid_params(self):
        resp = self.client.post(self.path)
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry')
        assert not Team.objects.filter(pk=self.team.pk).exists()


class NewTeamMemberTest(BaseTeamTest):
    @fixture
    def path(self):
        return reverse('sentry-new-team-member', args=[self.team.slug])

    def test_does_load(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/teams/members/new.html')

    @mock.patch('sentry.web.frontend.teams.can_add_team_member')
    def test_missing_permission(self, can_add_team_member):
        can_add_team_member.return_value = False
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 302)
        can_add_team_member.assert_called_once_with(self.user, self.team)

    def test_cannot_add_existing_member(self):
        resp = self.client.post(self.path, {
            'add-type': MEMBER_USER,
            'add-user': self.team.owner.username,
        })
        self.assertEquals(resp.status_code, 200)
        self.assertIn('user', resp.context['add_form'].errors)

    def test_does_add_existing_user_as_member(self):
        user = User.objects.create(username='newuser')
        resp = self.client.post(self.path, {
            'add-type': MEMBER_USER,
            'add-user': user.username,
        })
        self.assertEquals(resp.status_code, 302, resp.context['add_form'].errors if resp.status_code != 302 else None)
        member = self.team.member_set.get(user=user)
        self.assertEquals(member.type, MEMBER_USER)

    def test_cannot_invite_existing_member(self):
        resp = self.client.post(self.path, {
            'invite-type': MEMBER_USER,
            'invite-email': self.team.owner.email,
        })
        self.assertEquals(resp.status_code, 200)
        self.assertIn('email', resp.context['invite_form'].errors)

    @mock.patch('sentry.models.PendingTeamMember.send_invite_email')
    def test_does_invite_already_registered_user(self, send_invite_email):
        user = User.objects.create(username='newuser', email='newuser@example.com')
        resp = self.client.post(self.path, {
            'invite-type': MEMBER_USER,
            'invite-email': user.email,
        })
        self.assertEquals(resp.status_code, 302)
        ptm = PendingTeamMember.objects.get(email=user.email, team=self.team)
        self.assertEquals(ptm.type, MEMBER_USER)
        send_invite_email.assert_called_once_with()

    @mock.patch('sentry.models.PendingTeamMember.send_invite_email')
    def test_does_invite_unregistered_user(self, send_invite_email):
        resp = self.client.post(self.path, {
            'invite-type': MEMBER_USER,
            'invite-email': 'newuser@example.com',
        })
        self.assertEquals(resp.status_code, 302)
        ptm = PendingTeamMember.objects.get(email='newuser@example.com', team=self.team)
        self.assertEquals(ptm.type, MEMBER_USER)
        send_invite_email.assert_called_once_with()


class AcceptInviteTest(BaseTeamTest):
    def test_invalid_member_id(self):
        resp = self.client.get(reverse('sentry-accept-invite', args=[1, 2]))
        self.assertEquals(resp.status_code, 302)

    def test_invalid_token(self):
        ptm = PendingTeamMember.objects.create(
            email='newuser@example.com',
            team=self.team,
        )
        resp = self.client.get(reverse('sentry-accept-invite', args=[ptm.id, 2]))
        self.assertEquals(resp.status_code, 302)

    def test_renders_unauthenticated_template(self):
        self.client.logout()
        ptm = PendingTeamMember.objects.create(
            email='newuser@example.com',
            team=self.team,
        )
        resp = self.client.get(reverse('sentry-accept-invite', args=[ptm.id, ptm.token]))
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/teams/members/accept_invite_unauthenticated.html')

    def test_renders_authenticated_template(self):
        ptm = PendingTeamMember.objects.create(
            email='newuser@example.com',
            team=self.team,
        )
        resp = self.client.get(reverse('sentry-accept-invite', args=[ptm.id, ptm.token]))
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/teams/members/accept_invite.html')

    def test_can_accept_while_authenticated(self):
        ptm = PendingTeamMember.objects.create(
            email='newuser@example.com',
            type=MEMBER_USER,
            team=self.team,
        )
        resp = self.client.post(reverse('sentry-accept-invite', args=[ptm.id, ptm.token]))
        self.assertEquals(resp.status_code, 302, resp.context['form'].errors if resp.status_code != 302 else None)
        self.assertFalse(PendingTeamMember.objects.filter(id=ptm.id).exists())
        self.assertTrue(TeamMember.objects.filter(user=self.user, team=self.team).exists())

    def test_cannot_accept_while_unauthenticated(self):
        self.client.logout()
        ptm = PendingTeamMember.objects.create(
            email='newuser@example.com',
            type=MEMBER_USER,
            team=self.team,
        )
        resp = self.client.post(reverse('sentry-accept-invite', args=[ptm.id, ptm.token]))
        self.assertTemplateUsed(resp, 'sentry/teams/members/accept_invite_unauthenticated.html')
        self.assertEquals(resp.status_code, 200)


class BaseAccessGroupTest(BaseTeamTest):
    @before
    def create_group(self):
        self.group = AccessGroup.objects.create(team=self.team, name='Test')
        self.group.members.add(self.user)
        self.group.projects.add(self.project)


class ManageAccessGroupsTest(BaseAccessGroupTest):
    @fixture
    def path(self):
        return reverse('sentry-manage-access-groups', args=[self.team.slug])

    def test_does_render_with_context(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/groups/list.html')
        assert list(resp.context['group_list']) == [self.group]


class AccessGroupDetailsTest(BaseAccessGroupTest):
    @fixture
    def path(self):
        return reverse('sentry-edit-access-group', args=[self.team.slug, self.group.id])

    def test_does_render_with_context(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/groups/details.html')
        assert 'form' in resp.context
        assert resp.context['group'] == self.group


class RemoveAccessGroupTest(BaseAccessGroupTest):
    @fixture
    def path(self):
        return reverse('sentry-remove-access-group', args=[self.team.slug, self.group.id])

    def test_does_render_with_context(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/groups/remove.html')
        assert 'form' in resp.context
        assert resp.context['group'] == self.group

    def test_does_delete(self):
        resp = self.client.post(self.path, {})
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-manage-access-groups', args=[self.team.slug])
        assert not AccessGroup.objects.filter(id=self.group.id).exists()


class AccessGroupMembersTest(BaseAccessGroupTest):
    @fixture
    def path(self):
        return reverse('sentry-access-group-members', args=[self.team.slug, self.group.id])

    def test_does_render_with_context(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/groups/members.html')
        assert 'form' in resp.context
        assert resp.context['group'] == self.group
        assert list(resp.context['member_list']) == [self.user]

    def test_does_add_member(self):
        user = User.objects.create(username='bobross')
        resp = self.client.post(self.path, {
            'user': user.username
        })
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + self.path
        assert self.group.members.filter(id=user.id).exists()


class AccessGroupProjectsTest(BaseAccessGroupTest):
    @fixture
    def path(self):
        return reverse('sentry-access-group-projects', args=[self.team.slug, self.group.id])

    def test_does_render_with_context(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/groups/projects.html')
        assert 'form' in resp.context
        assert resp.context['group'] == self.group
        assert list(resp.context['project_list']) == [self.project]

    def test_does_add_member(self):
        project = Project.objects.create(team=self.team, name='Sample')
        resp = self.client.post(self.path, {
            'project': project.slug
        })
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + self.path
        assert self.group.projects.filter(id=project.id).exists()


class ManageProjectsTest(BaseTeamTest):
    @fixture
    def path(self):
        return reverse('sentry-manage-team-projects', args=[self.team.slug])

    def test_does_render_with_context(self):
        # HACK: force project create
        project = self.project
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/projects/index.html')
        assert list(resp.context['project_list']) == [project]
        assert resp.context['team'] == self.team
        assert resp.context['page'] == 'projects'
        assert resp.context['SUBSECTION'] == 'projects'


class ManageMembersTest(BaseTeamTest):
    @fixture
    def path(self):
        return reverse('sentry-manage-team-members', args=[self.team.slug])

    def test_does_render_with_context(self):
        pm = self.team.pending_member_set.create(email='foo@example.com')
        tm = self.team.member_set.get()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/members/index.html')
        assert list(resp.context['member_list']) == [
            (tm, tm.user),
        ]
        assert list(resp.context['pending_member_list']) == [
            (pm, pm.email),
        ]
        assert resp.context['team'] == self.team
        assert resp.context['page'] == 'members'
        assert resp.context['SUBSECTION'] == 'members'

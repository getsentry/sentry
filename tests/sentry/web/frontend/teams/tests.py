# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse
from exam import before, fixture

from sentry.constants import MEMBER_OWNER, MEMBER_USER
from sentry.models import (
    Team, TeamMember, PendingTeamMember, User)
from sentry.testutils import TestCase


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

# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.models import Team, MEMBER_OWNER

from tests.base import TestCase


class BaseTeamTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="user", email="admin@localhost", is_staff=False, is_superuser=False)
        self.user.set_password('user')
        self.user.save()
        self.team = Team.objects.create(name='foo', slug='foo', owner=self.user)
        self.client.login(username='user', password='user')


class TeamListTest(BaseTeamTest):
    def test_loads(self):
        resp = self.client.post(reverse('sentry-team-list'))
        self.assertEquals(resp.status_code, 200)


class NewTeamTest(BaseTeamTest):
    @mock.patch('sentry.web.frontend.teams.can_create_teams', mock.Mock(return_value=False))
    def test_missing_permission(self):
        resp = self.client.post(reverse('sentry-new-team'))
        self.assertEquals(resp.status_code, 302)
        self.assertEquals(resp['Location'], 'http://testserver' + reverse('sentry'))

    @mock.patch('sentry.web.frontend.teams.can_create_teams', mock.Mock(return_value=True))
    def test_missing_params(self):
        resp = self.client.post(reverse('sentry-new-team'))
        self.assertEquals(resp.status_code, 200)

    @mock.patch('sentry.web.frontend.teams.can_create_teams', mock.Mock(return_value=True))
    def test_valid_params(self):
        resp = self.client.post(reverse('sentry-new-team'), {
            'name': 'Test Team',
            'slug': 'test',
        })
        self.assertNotEquals(resp.status_code, 200)

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
        user = User.objects.create(username="other", email="other@localhost")

        resp = self.client.post(reverse('sentry-new-team'), {
            'name': 'Test Team',
            'slug': 'test',
            'owner': 'other',
        })
        self.assertNotEquals(resp.status_code, 200)

        team = Team.objects.filter(name='Test Team')
        self.assertTrue(team.exists())
        team = team.get()

        self.assertEquals(team.owner, user)

        member_set = list(team.member_set.all())

        self.assertEquals(len(member_set), 1)
        member = member_set[0]
        self.assertEquals(member.user, user)
        self.assertEquals(member.type, MEMBER_OWNER)

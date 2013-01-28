# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.core.urlresolvers import reverse

from sentry.models import TrackedUser
from sentry.testutils import TestCase, fixture

logger = logging.getLogger(__name__)


class UserListTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-users', args=[self.team.slug])

    def test_missing_permission(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302

    def test_invalid_team_slug(self):
        resp = self.client.get(reverse('sentry-users', args=['a']))
        assert resp.status_code == 302

    def test_does_render(self):
        self.login_as(self.user)

        tuser = TrackedUser.objects.create(
            project=self.project,
            ident='foo',
            email='foo@example.com',
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/users/list.html')
        assert resp.context['team'] == self.team
        assert resp.context['SECTION'] == 'users'
        assert list(resp.context['tuser_list']) == [tuser]


class UserDetailsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-user-details', args=[self.team.slug, self.tuser.id])

    @fixture
    def tuser(self):
        return TrackedUser.objects.create(
            project=self.project,
            ident='foo',
            email='foo@example.com',
        )

    def test_missing_permission(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302

    def test_invalid_team_slug(self):
        resp = self.client.get(reverse('sentry-user-details', args=['a', self.tuser.id]))
        assert resp.status_code == 302

    def test_invalid_tuser_id(self):
        resp = self.client.get(reverse('sentry-user-details', args=[self.team.slug, 0]))
        assert resp.status_code == 302

    def test_does_load(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/users/details.html')
        assert resp.context['team'] == self.team
        assert resp.context['tuser'] == self.tuser
        assert resp.context['SECTION'] == 'users'

# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.core.urlresolvers import reverse

from sentry.models import TagValue
from sentry.testutils import TestCase, fixture

logger = logging.getLogger(__name__)


class UserListTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-users', args=[
            self.team.slug, self.project.slug])

    def test_missing_permission(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302

    def test_invalid_team_slug(self):
        resp = self.client.get(reverse('sentry-users', args=['a', 'b']))
        assert resp.status_code == 302

    def test_does_render(self):
        self.login_as(self.user)

        tag = TagValue.objects.create(
            project=self.project,
            key='sentry:user',
            value='foo',
        )

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/users/list.html')
        assert resp.context['team'] == self.team
        assert resp.context['SECTION'] == 'users'
        assert list(resp.context['tag_list']) == [tag]


class UserDetailsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-user-details', args=[
            self.team.slug, self.project.slug, self.tag.id])

    @fixture
    def tag(self):
        return TagValue.objects.create(
            project=self.project,
            key='sentry:user',
            value='foo',
        )

    def test_missing_permission(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302

    def test_invalid_tuser_id(self):
        resp = self.client.get(reverse('sentry-user-details', args=[
            self.team.slug, self.project.slug, 0]))
        assert resp.status_code == 302

    def test_does_load(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/users/details.html')
        assert resp.context['team'] == self.team
        assert resp.context['tag'] == self.tag
        assert resp.context['SECTION'] == 'users'

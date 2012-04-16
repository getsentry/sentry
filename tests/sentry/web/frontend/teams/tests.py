# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.models import Team, MEMBER_OWNER

from tests.base import TestCase

logger = logging.getLogger(__name__)


class NewProjectTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()
        self.team = Team.objects.create(name='foo', slug='foo', owner=self.user)

    def test_new_team(self):
        path = reverse('sentry-new-team')

        self.client.login(username='admin', password='admin')

        # missing name
        resp = self.client.post(path)
        self.assertEquals(resp.status_code, 200)

        # valid params
        resp = self.client.post(path, {
            'name': 'Test Team',
            'slug': 'test',
            'owner': 'admin',
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

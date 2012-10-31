# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.constants import MEMBER_OWNER
from sentry.models import Project, Team

from tests.base import TestCase

logger = logging.getLogger(__name__)


class NewProjectTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()
        self.team = Team.objects.create(name='foo', slug='foo', owner=self.user)

    def test_new_project(self):
        path = reverse('sentry-new-team-project', args=[self.team.slug])

        self.client.login(username='admin', password='admin')

        # missing name
        resp = self.client.post(path)
        self.assertEquals(resp.status_code, 200)

        # valid params
        resp = self.client.post(path, {
            'name': 'Test Project',
            'slug': 'test',
        })
        self.assertNotEquals(resp.status_code, 200)

        project = Project.objects.filter(name='Test Project')
        self.assertTrue(project.exists())
        project = project.get()

        self.assertEquals(project.owner, self.user)
        self.assertNotEquals(project.team, None)

        member_set = list(project.team.member_set.all())

        self.assertEquals(len(member_set), 1)
        member = member_set[0]
        self.assertEquals(member.user, self.user)
        self.assertEquals(member.type, MEMBER_OWNER)

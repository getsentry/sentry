# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.models import Project, MEMBER_OWNER

from tests.base import TestCase

logger = logging.getLogger(__name__)


class NewProjectTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()

    def test_new_project(self):
        self.client.login(username='admin', password='admin')

        # missing name
        path = reverse('sentry-new-project')
        resp = self.client.post(path, {})
        self.assertEquals(resp.status_code, 200)

        # valid params
        path = reverse('sentry-new-project')
        resp = self.client.post(path, {
            'name': 'Test Project',
        })
        self.assertNotEquals(resp.status_code, 200)

        project = Project.objects.filter(name='Test Project')
        self.assertTrue(project.exists())
        project = project.get()

        self.assertEquals(project.owner, self.user)

        member_set = list(project.member_set.all())

        self.assertEquals(len(member_set), 1)
        member = member_set[0]
        self.assertEquals(member.user, self.user)
        self.assertEquals(member.type, MEMBER_OWNER)

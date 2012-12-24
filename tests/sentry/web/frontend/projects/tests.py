# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.core.urlresolvers import reverse

from sentry.constants import MEMBER_OWNER
from sentry.models import Project
from sentry.testutils import TestCase, fixture

logger = logging.getLogger(__name__)


class NewProjectTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-new-team-project', args=[self.team.slug])

    def test_unauthenticated_does_redirect(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 302)

    def test_does_load(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed('sentry/projects/new.html')

    def test_missing_name(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)
        self.assertEquals(resp.status_code, 200)

    def test_valid_params(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, {
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


class ManageProjectTeamTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-manage-project-team', args=[self.project.id])

    def test_unauthenticated_does_redirect(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 302)

    def test_renders_with_required_context(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed('sentry/projects/team.html')
        self.assertIn('pending_member_list', resp.context)

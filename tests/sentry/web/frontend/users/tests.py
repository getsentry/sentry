# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase, fixture

logger = logging.getLogger(__name__)


class UserListTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-users', args=[self.project.slug])

    def test_missing_permission(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302

    def test_does_load(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed('sentry/users/list.html')

# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase


@pytest.mark.xfail
class ReplayTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-replay', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
            'group_id': self.group.id,
            'event_id': self.event.id,
        })

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/events/replay_request.html')

# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.testutils import TestCase


class ReplayTest(TestCase):
    @fixture
    def path(self):
        return '/{}/{}/issues/{}/events/{}/replay/'.format(
            self.organization.slug,
            self.project.slug,
            self.group.id,
            self.event.id,
        )

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/events/replay_request.html')

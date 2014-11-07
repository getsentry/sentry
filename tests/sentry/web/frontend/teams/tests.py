# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import before, fixture

from sentry.constants import MEMBER_OWNER, MEMBER_USER
from sentry.models import User
from sentry.testutils import TestCase


class BaseTeamTest(TestCase):
    @fixture
    def user2(self):
        user = User.objects.create(username="other", email="other@localhost")
        self.team.member_set.create(user=user, type=MEMBER_USER)
        return user

    @fixture
    def tm(self):
        return self.team.member_set.get(user=self.user, type=MEMBER_OWNER)

    @fixture
    def tm2(self):
        return self.team.member_set.get(user=self.user2)

    @before
    def login_user(self):
        self.login_as(self.user)


class ManageProjectsTest(BaseTeamTest):
    @fixture
    def path(self):
        return reverse('sentry-manage-team-projects', args=[self.team.slug])

    def test_does_render_with_context(self):
        # HACK: force project create
        project = self.project
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/projects/index.html')
        assert list(resp.context['project_list']) == [project]
        assert resp.context['team'] == self.team

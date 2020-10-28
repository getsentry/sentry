# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import Counter
from sentry.testutils import TestCase


class ProjectCounterTest(TestCase):
    def test_increment(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])

        assert Counter.increment(project, 42) == 42
        assert Counter.increment(project, 1) == 43

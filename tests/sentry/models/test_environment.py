from __future__ import absolute_import

from sentry.models import Environment
from sentry.testutils import TestCase


class GetOrCreateTest(TestCase):
    def test_simple(self):
        project = self.create_project()

        env = Environment.get_or_create(
            project=project,
            name='prod',
        )

        assert env.name == 'prod'
        assert env.projects.first().id == project.id

        env2 = Environment.get_or_create(
            project=project,
            name='prod',
        )

        assert env2.id == env.id

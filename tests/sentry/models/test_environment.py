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

        assert env.project_id == project.id
        assert env.name == 'prod'

        env2 = Environment.get_or_create(
            project=project,
            name='prod',
        )

        assert env2.id == env.id

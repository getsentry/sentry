from __future__ import absolute_import

import pytest

from sentry.models import Environment
from sentry.testutils import TestCase


class GetOrCreateTest(TestCase):
    def test_simple(self):
        project = self.create_project()

        with pytest.raises(Environment.DoesNotExist):
            Environment.get_for_organization_id(
                project.organization_id,
                'prod',
            )

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

        with self.assertNumQueries(0):
            assert Environment.get_for_organization_id(
                project.organization_id,
                'prod',
            ).id == env.id

from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models import DiscoverSavedQuery, DiscoverSavedQueryProject


class DiscoverSavedQueryTest(TestCase):
    def test_create(self):
        org = self.create_organization()
        project_ids = [
            self.create_project(organization=org).id,
            self.create_project(organization=org).id
        ]
        query = {
            'fields': ['test'],
            'conditions': [],
            'limit': 10
        }

        model = DiscoverSavedQuery.objects.create(organization=org, query=query)

        model.add_projects(project_ids)

        assert DiscoverSavedQuery.objects.get(id=model.id).query == query
        assert sorted(
            DiscoverSavedQueryProject.objects.all().values_list('project_id', flat=True)
        ) == project_ids

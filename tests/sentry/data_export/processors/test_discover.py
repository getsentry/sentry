from __future__ import absolute_import

from sentry.data_export.base import ExportError
from sentry.data_export.processors.discover import DiscoverProcessor
from sentry.testutils import TestCase, SnubaTestCase


class DiscoverProcessorTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(DiscoverProcessorTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

    def test_get_projects(self):
        project = DiscoverProcessor.get_projects(
            organization_id=self.org.id, query={"project": [self.project1.id]}
        )
        assert project[0] == self.project1
        projects = DiscoverProcessor.get_projects(
            organization_id=self.org.id, query={"project": [self.project1.id, self.project2.id]}
        )
        assert sorted(projects) == sorted([self.project1, self.project2])
        with self.assertRaises(ExportError):
            DiscoverProcessor.get_projects(organization_id=self.org.id, query={"project": -1})

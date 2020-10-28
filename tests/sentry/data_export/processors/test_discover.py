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
        self.group = self.create_group(project=self.project1)
        self.discover_query = {
            "statsPeriod": "14d",
            "project": [self.project1.id, self.project2.id],
            "field": ["count(id)", "fake(field)", "issue"],
            "query": "",
        }

    def test_get_projects(self):
        project = DiscoverProcessor.get_projects(
            organization_id=self.org.id, query={"project": [self.project1.id]}
        )
        assert isinstance(project, list)
        assert project[0] == self.project1
        projects = DiscoverProcessor.get_projects(
            organization_id=self.org.id, query={"project": [self.project1.id, self.project2.id]}
        )
        assert sorted([p.id for p in projects]) == sorted([self.project1.id, self.project2.id])
        with self.assertRaises(ExportError):
            DiscoverProcessor.get_projects(organization_id=self.org.id, query={"project": [-1]})

    def test_handle_fields(self):
        processor = DiscoverProcessor(
            organization_id=self.org.id, discover_query=self.discover_query
        )
        assert processor.header_fields == ["count_id", "fake_field", "issue"]
        result_list = [{"issue": self.group.id, "issue.id": self.group.id}]
        new_result_list = processor.handle_fields(result_list)
        assert new_result_list[0] != result_list
        assert new_result_list[0]["issue"] == self.group.qualified_short_id

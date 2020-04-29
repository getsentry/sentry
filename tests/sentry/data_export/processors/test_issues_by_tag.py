from __future__ import absolute_import

from sentry.models import EventUser, Group, Project
from sentry.data_export.base import ExportError
from sentry.data_export.processors.issues_by_tag import IssuesByTagProcessor
from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class IssuesByTagProcessorTest(TestCase, SnubaTestCase):
    generic_header_fields = ["value", "times_seen", "last_seen", "first_seen"]
    user_header_fields = [
        "value",
        "id",
        "email",
        "username",
        "ip_address",
        "times_seen",
        "last_seen",
        "first_seen",
    ]

    def setUp(self):
        super(IssuesByTagProcessorTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.event = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "timestamp": iso_format(before_now(seconds=3)),
                "user": {"email": self.user.email},
            },
            project_id=self.project.id,
        )
        self.group = self.event.group
        self.euser = EventUser.objects.get(email=self.user.email, project_id=self.project.id)

    def test_get_project(self):
        project = IssuesByTagProcessor.get_project(project_id=self.project.id)
        assert isinstance(project, Project)
        assert project == self.project
        with self.assertRaises(ExportError):
            IssuesByTagProcessor.get_project(project_id=-1)

    def test_get_group(self):
        group = IssuesByTagProcessor.get_group(group_id=self.group.id, project=self.project)
        assert isinstance(group, Group)
        assert group == self.group
        with self.assertRaises(ExportError):
            IssuesByTagProcessor.get_group(group_id=-1, project=self.project)

    def test_get_header_fields(self):
        assert IssuesByTagProcessor.get_header_fields("generic") == self.generic_header_fields
        assert IssuesByTagProcessor.get_header_fields("user") == self.user_header_fields

    def test_get_lookup_key(self):
        assert IssuesByTagProcessor.get_lookup_key("generic") == "generic"
        assert IssuesByTagProcessor.get_lookup_key("user") == "sentry:user"

    def test_get_eventuser_callback(self):
        user_callback = IssuesByTagProcessor.get_eventuser_callback(self.project.id)
        processor = IssuesByTagProcessor(
            project_id=self.project.id, group_id=self.group.id, key="user", environment_id=None
        )
        sample = processor.get_raw_data()[0]
        user_callback([sample])
        assert sample._eventuser == self.euser

    def test_get_callbacks(self):
        generic_callbacks = IssuesByTagProcessor.get_callbacks("generic", self.project.id)
        assert isinstance(generic_callbacks, list)
        assert len(generic_callbacks) == 0
        user_callbacks = IssuesByTagProcessor.get_callbacks("user", self.project.id)
        assert isinstance(user_callbacks, list)
        assert len(user_callbacks) == 1

    def test_serialize_row(self):
        processor = IssuesByTagProcessor(
            project_id=self.project.id, group_id=self.group.id, key="user", environment_id=None
        )
        sample = processor.get_raw_data()[0]
        generic_row = IssuesByTagProcessor.serialize_row(sample, "generic")
        assert sorted(generic_row.keys()) == sorted(self.generic_header_fields)
        user_row = IssuesByTagProcessor.serialize_row(sample, "user")
        assert sorted(user_row.keys()) == sorted(self.user_header_fields)

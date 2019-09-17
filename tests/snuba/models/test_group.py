from __future__ import absolute_import

from sentry.models import Group
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class GroupTestSnuba(TestCase, SnubaTestCase):
    def test_get_oldest_latest_for_environments(self):
        project = self.create_project()

        min_ago = iso_format(before_now(minutes=1))

        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "production",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "c" * 32, "timestamp": min_ago, "fingerprint": ["group-1"]},
            project_id=project.id,
        )

        group = Group.objects.first()

        assert group.get_latest_event_for_environments().event_id == "c" * 32
        assert group.get_latest_event_for_environments(["staging"]) is None
        assert group.get_latest_event_for_environments(["production"]).event_id == "b" * 32
        assert group.get_oldest_event_for_environments().event_id == "a" * 32
        assert (
            group.get_oldest_event_for_environments(["staging", "production"]).event_id == "a" * 32
        )
        assert group.get_oldest_event_for_environments(["staging"]) is None

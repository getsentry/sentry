from __future__ import absolute_import

from sentry.eventstore.nodestore.backend import NodestoreEventStorage
from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.samples import load_data


class NodestoreEventStorageTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(NodestoreEventStorageTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.project = self.create_project()

        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "default",
                "platform": "python",
                "fingerprint": ["group1"],
                "timestamp": self.min_ago,
                "tags": {"foo": "1"},
            },
            project_id=self.project.id,
        )

        event_data = load_data("transaction")
        event_data["timestamp"] = iso_format(before_now(minutes=1))
        event_data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=1))
        event_data["event_id"] = "b" * 32
        self.transaction_event = self.store_event(data=event_data, project_id=self.project.id)

        self.eventstore = NodestoreEventStorage()

    def test_get_event_by_id(self):
        event = self.eventstore.get_event_by_id(self.project.id, "a" * 32)
        assert event
        assert event.group_id == event.group.id

        # Transaction event
        event = self.eventstore.get_event_by_id(self.project.id, "b" * 32)
        assert event
        assert not event.group_id
        assert not event.group

        # Non existent event
        event = self.eventstore.get_event_by_id(self.project.id, "c" * 32)
        assert not event

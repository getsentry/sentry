from uuid import uuid4

from sentry.deletions.tasks.nodestore import (
    delete_events_for_groups_from_nodestore_and_eventstore,
    fetch_events,
)
from sentry.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase


class NodestoreDeletionTaskTest(TestCase):

    def create_n_events_with_group(self, n_events: int) -> list[Event]:
        events = []
        for _ in range(n_events):
            event = self.store_event(
                data={"fingerprint": [uuid4().hex]},
                project_id=self.project.id,
            )
            events.append(event)
        return events

    def fetch_events(self, group_ids: list[int], dataset: Dataset) -> list[Event]:
        return fetch_events(
            group_ids=group_ids,
            project_id=self.project.id,
            referrer="deletions.groups",
            dataset=dataset,
            tenant_ids={
                "referrer": "deletions.groups",
                "organization_id": self.project.organization_id,
            },
        )

    def test_simple_deletion_with_events(self) -> None:
        """Test nodestore deletion when events are found."""
        events = self.create_n_events_with_group(n_events=5)
        group_ids = [event.group_id for event in events if event.group_id is not None]

        # Verify events exist in both eventstore and nodestore before deletion
        events = self.fetch_events(group_ids, dataset=Dataset.Events)
        assert len(events) == 5

        with self.tasks():
            delete_events_for_groups_from_nodestore_and_eventstore.apply_async(
                kwargs={
                    "organization_id": self.project.organization_id,
                    "project_id": self.project.id,
                    "group_ids": group_ids,
                    "transaction_id": uuid4().hex,
                    "dataset_str": Dataset.Events.value,
                    "referrer": "deletions.groups",
                },
            )

        # Events should still exist in eventstore/snuba (that's handled by a different task)
        events_after = self.fetch_events(group_ids, dataset=Dataset.Events)
        assert len(events_after) == 5

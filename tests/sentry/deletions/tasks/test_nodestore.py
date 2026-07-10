from uuid import uuid4

import pytest

from sentry.deletions.tasks.nodestore import (
    delete_events_for_groups_from_nodestore_and_eventstore,
    fetch_events_from_eventstore,
)
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import TestCase
from sentry.utils.snuba import UnqualifiedQueryError


class NodestoreDeletionTaskTest(TestCase):
    def create_n_events_with_group(self, n_events: int) -> list[Event]:
        events = []
        for _ in range(n_events):
            event = self.store_event(
                data={"fingerprint": [uuid4().hex]}, project_id=self.project.id
            )
            events.append(event)
        return events

    def fetch_events_from_eventstore(
        self,
        group_ids: list[int],
        dataset: Dataset,
        last_event_id: str | None = None,
        last_event_timestamp: str | None = None,
    ) -> list[Event]:
        return fetch_events_from_eventstore(
            project_id=self.project.id,
            group_ids=group_ids,
            dataset=dataset,
            referrer=Referrer.DELETIONS_GROUP.value,
            tenant_ids={
                "referrer": Referrer.DELETIONS_GROUP.value,
                "organization_id": self.project.organization_id,
            },
            last_event_id=last_event_id,
            last_event_timestamp=last_event_timestamp,
        )

    def test_simple_deletion_with_events(self) -> None:
        """Test nodestore deletion when events are found."""
        events = self.create_n_events_with_group(n_events=5)
        group_ids = [event.group_id for event in events if event.group_id is not None]

        # Verify events exist in both eventstore and nodestore before deletion
        events = self.fetch_events_from_eventstore(group_ids, dataset=Dataset.Events)
        assert len(events) == 5

        with self.tasks():
            delete_events_for_groups_from_nodestore_and_eventstore.apply_async(
                kwargs={
                    "organization_id": self.project.organization_id,
                    "project_id": self.project.id,
                    "group_ids": group_ids,
                    "times_seen": [1] * len(group_ids),
                    "transaction_id": uuid4().hex,
                    "dataset_str": Dataset.Events.value,
                    "referrer": "deletions.groups",
                },
            )

        # Events should be deleted from eventstore after nodestore deletion
        events_after = self.fetch_events_from_eventstore(group_ids, dataset=Dataset.Events)
        assert len(events_after) == 0

    def test_deletion_with_project_deleted(self) -> None:
        """Test nodestore deletion when project is deleted."""
        events = self.create_n_events_with_group(n_events=5)
        group_ids = [event.group_id for event in events if event.group_id is not None]

        # Verify events exist in both eventstore and nodestore before deletion
        events = self.fetch_events_from_eventstore(group_ids, dataset=Dataset.Events)
        assert len(events) == 5

        # Deleting the project will cause Snuba to raise an error when fetching the event IDs.
        self.project.delete()

        with self.tasks():
            # To delete events from the nodestore we fetch the event IDs from the eventstore (Snuba),
            # however, when we delete the project, Snuba will raise an error.
            delete_events_for_groups_from_nodestore_and_eventstore.apply_async(
                kwargs={
                    "organization_id": self.project.organization_id,
                    "project_id": self.project.id,
                    "group_ids": group_ids,
                    "times_seen": [1] * len(group_ids),
                    "transaction_id": uuid4().hex,
                    "dataset_str": Dataset.Events.value,
                    "referrer": "deletions.groups",
                },
            )

        with pytest.raises(UnqualifiedQueryError):
            self.fetch_events_from_eventstore(group_ids, dataset=Dataset.Events)

    def test_fetch_events_with_pagination_cursor(self) -> None:
        """Fetching with a cursor (last event's id/timestamp) returns the remaining events."""
        events = self.create_n_events_with_group(n_events=5)
        group_ids = [event.group_id for event in events if event.group_id is not None]

        all_events = self.fetch_events_from_eventstore(group_ids, dataset=Dataset.Events)
        assert len(all_events) == 5

        cursor_event = all_events[0]
        remaining = self.fetch_events_from_eventstore(
            group_ids,
            dataset=Dataset.Events,
            last_event_id=cursor_event.event_id,
            last_event_timestamp=cursor_event.timestamp,
        )
        # Results are ordered by -timestamp, -event_id, so the keyset cursor excludes everything
        # at or before the first event, returning the strictly-later remainder.
        assert cursor_event.event_id not in {event.event_id for event in remaining}
        assert len(remaining) == len(all_events) - 1

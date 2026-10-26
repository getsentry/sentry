from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from sentry.deletions.tasks.nodestore import (
    DELETE_EVENTS_TASK_KEY,
    delete_events_for_groups_from_nodestore_and_eventstore,
    fetch_events_from_eventstore,
)
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
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

    def run_deletion_task(self, group_id: int = 1) -> None:
        delete_events_for_groups_from_nodestore_and_eventstore(
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_ids=[group_id],
            times_seen=[1],
            transaction_id="transaction-id",
            dataset_str=Dataset.Events.value,
            referrer=Referrer.DELETIONS_GROUP.value,
        )

    def test_project_killswitch_stops_deletion_chain(self) -> None:
        with (
            override_options({"deletions.nodestore.killswitch-projects": [self.project.id]}),
            patch(
                "sentry.deletions.tasks.nodestore.fetch_events_from_eventstore"
            ) as mock_fetch_events,
            patch(
                "sentry.deletions.tasks.nodestore.delete_events_from_eventstore"
            ) as mock_delete_events,
            patch.object(
                delete_events_for_groups_from_nodestore_and_eventstore, "apply_async"
            ) as mock_apply_async,
        ):
            self.run_deletion_task()

        mock_fetch_events.assert_not_called()
        mock_delete_events.assert_not_called()
        mock_apply_async.assert_not_called()

    def test_project_killswitch_does_not_stop_other_projects(self) -> None:
        other_project = self.create_project()
        with (
            override_options({"deletions.nodestore.killswitch-projects": [other_project.id]}),
            patch(
                "sentry.deletions.tasks.nodestore.fetch_events_from_eventstore", return_value=[]
            ) as mock_fetch_events,
            patch(
                "sentry.deletions.tasks.nodestore.delete_events_from_eventstore"
            ) as mock_delete_events,
        ):
            self.run_deletion_task()

        mock_fetch_events.assert_called_once()
        mock_delete_events.assert_called_once_with(
            self.organization.id,
            self.project.id,
            [1],
            [1],
            Dataset.Events,
        )

    @patch("sentry.deletions.tasks.nodestore.current_task")
    def test_selfchain_skips_when_already_spawned(self, mock_current_task: MagicMock) -> None:
        activation_id = "nodestore-delete-act-skip"
        mock_current_task.return_value = SimpleNamespace(id=activation_id)
        mark_spawned(DELETE_EVENTS_TASK_KEY, activation_id)

        with patch(
            "sentry.deletions.tasks.nodestore.fetch_events_from_eventstore",
            side_effect=AssertionError("duplicate activation should not fetch events"),
        ) as mock_fetch_events:
            self.run_deletion_task()

        mock_fetch_events.assert_not_called()

    @patch("sentry.deletions.tasks.nodestore.current_task")
    def test_selfchain_marks_and_dedupes_across_deliveries(
        self, mock_current_task: MagicMock
    ) -> None:
        activation_id = "nodestore-delete-act-dedupe"
        mock_current_task.return_value = SimpleNamespace(id=activation_id)
        event = self.create_n_events_with_group(n_events=1)[0]
        assert event.group_id is not None

        with patch.object(
            delete_events_for_groups_from_nodestore_and_eventstore, "apply_async"
        ) as mock_apply_async:
            self.run_deletion_task(event.group_id)
            assert mock_apply_async.call_count == 1
            assert already_spawned(DELETE_EVENTS_TASK_KEY, activation_id) is True

            self.run_deletion_task(event.group_id)

        assert mock_apply_async.call_count == 1

    @patch("sentry.deletions.tasks.nodestore.mark_spawned")
    @patch("sentry.deletions.tasks.nodestore.current_task", return_value=None)
    def test_selfchain_is_inert_without_activation(
        self, mock_current_task: MagicMock, mock_mark_spawned: MagicMock
    ) -> None:
        event = self.create_n_events_with_group(n_events=1)[0]
        assert event.group_id is not None

        with patch.object(
            delete_events_for_groups_from_nodestore_and_eventstore, "apply_async"
        ) as mock_apply_async:
            self.run_deletion_task(event.group_id)

        assert mock_apply_async.call_count == 1
        mock_mark_spawned.assert_not_called()

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

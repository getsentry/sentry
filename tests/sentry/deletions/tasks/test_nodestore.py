from collections.abc import Sequence
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from sentry.deletions.tasks.nodestore import (
    delete_events_for_groups_from_nodestore_and_eventstore,
    fetch_events_from_eventstore,
)
from sentry.exceptions import DeleteAborted
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.taskworker.retry import RetryError
from sentry.testutils.cases import TestCase
from sentry.utils.snuba import (
    QueryExecutionTimeMaximum,
    QueryMemoryLimitExceeded,
    QueryTooManySimultaneous,
    RateLimitExceeded,
    UnqualifiedQueryError,
)


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
        self, group_ids: Sequence[int], dataset: Dataset
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

    @patch("sentry.deletions.tasks.nodestore.metrics")
    def test_deletion_with_all_projects_deleted(self, mock_metrics: MagicMock) -> None:
        """
        Test that when a project is deleted before the task runs, it increments
        the correct metric and doesn't retry the task.

        Root cause: When deleting groups, if the project gets deleted concurrently,
        Snuba raises UnqualifiedQueryError with "All project_ids from the filter no longer exist".
        This is not a transient error - retrying won't help since the project is gone.
        The code tracks this scenario with a metric but allows the task to complete.
        """
        events = self.create_n_events_with_group(n_events=5)
        group_ids = [event.group_id for event in events if event.group_id is not None]

        # Delete the project to trigger the error
        self.project.delete()

        with self.tasks():
            # This will complete without raising DeleteAborted or RetryTask
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

        # Verify the metric was incremented with the correct tags
        mock_metrics.incr.assert_any_call(
            "deletions.nodestore.info", tags={"type": "all-projects-deleted"}, sample_rate=1
        )

    @patch("sentry.deletions.tasks.nodestore.metrics")
    @patch("sentry.deletions.tasks.nodestore.fetch_events_from_eventstore")
    def test_unqualified_query_error(self, mock_fetch: MagicMock, mock_metrics: MagicMock) -> None:
        """Test that UnqualifiedQueryError errors are tracked with the correct metric."""
        events = self.create_n_events_with_group(n_events=2)
        group_ids = [event.group_id for event in events if event.group_id is not None]
        mock_fetch.side_effect = UnqualifiedQueryError(
            "All project_ids from the filter no longer exist"
        )
        with self.tasks():
            with pytest.raises(DeleteAborted):
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

            # Verify metric was incremented with correct tags
            mock_metrics.incr.assert_any_call(
                "deletions.nodestore.error",
                tags={"type": "UnqualifiedQueryError"},
                sample_rate=1,
            )

    @patch("sentry.deletions.tasks.nodestore.metrics")
    @patch("sentry.deletions.tasks.nodestore.fetch_events_from_eventstore")
    def test_snuba_errors_retry(self, mock_fetch: MagicMock, mock_metrics: MagicMock) -> None:
        """Test that Snuba errors trigger a retry and are tracked with the correct metric."""
        events = self.create_n_events_with_group(n_events=2)
        group_ids = [event.group_id for event in events if event.group_id is not None]

        for snuba_error in [
            RateLimitExceeded("Rate limit exceeded"),
            QueryTooManySimultaneous("Too many simultaneous queries"),
            QueryMemoryLimitExceeded("Query exceeded memory limit"),
            QueryExecutionTimeMaximum("Query took too long"),
            UnqualifiedQueryError("All project_ids from the filter no longer exist"),
        ]:
            mock_fetch.side_effect = snuba_error
            with self.tasks():
                with pytest.raises(RetryError):
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

            # Verify metric was incremented with correct tags
            mock_metrics.incr.assert_any_call(
                # We track that we're retrying the task if we get a Snuba error
                "deletions.nodestore.retry",
                tags={"type": f"snuba-{type(snuba_error).__name__}"},
                sample_rate=1,
            )

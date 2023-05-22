import uuid
from collections import deque
from unittest.mock import Mock, patch

from django.test.utils import override_settings

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka, track_occurrence_producer_futures
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


def test_track_occurrence_producer_futures() -> None:
    with patch("sentry.issues.producer.occurrence_producer_futures", new=deque()):
        future_mock = Mock()
        future_mock.result = Mock()
        track_occurrence_producer_futures(future_mock)
        future_mock.result.assert_called_once_with()


@override_settings(SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT=2)  # type: ignore
def test_track_occurrence_producer_futures_with_multiple() -> None:
    with patch("sentry.issues.producer.occurrence_producer_futures", new=deque()):
        first_future_mock = Mock()
        first_future_mock.result = Mock()

        second_future_mock = Mock()
        second_future_mock.result = Mock()

        track_occurrence_producer_futures(first_future_mock)
        first_future_mock.result.assert_not_called()

        track_occurrence_producer_futures(second_future_mock)
        first_future_mock.result.assert_called_once_with()
        second_future_mock.assert_not_called()


class TestProduceOccurrenceToKafka(TestCase, OccurrenceTestMixin):  # type: ignore
    def test_event_id_mismatch(self) -> None:
        with self.assertRaisesMessage(
            ValueError, "Event id on occurrence and event_data must be the same"
        ):
            produce_occurrence_to_kafka(self.build_occurrence(), {"event_id": uuid.uuid4().hex})

    def test_with_event(self) -> None:
        occurrence = self.build_occurrence()
        produce_occurrence_to_kafka(
            occurrence,
            {
                "event_id": occurrence.event_id,
                "project_id": self.project.id,
                "title": "some problem",
                "platform": "python",
                "tags": {"my_tag": "2"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
            },
        )
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        assert occurrence.event_id == stored_occurrence.event_id

    def test_with_only_occurrence(self) -> None:
        event = self.store_event(data=load_data("transaction"), project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id, project_id=self.project.id)
        produce_occurrence_to_kafka(
            occurrence,
        )
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        assert occurrence.event_id == stored_occurrence.event_id

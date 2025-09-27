from datetime import datetime

from sentry.models.group import EventOrdering, get_oldest_or_latest_event
from sentry.testutils.cases import PerformanceIssueTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


class IncompatibilityTest(TestCase, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()
        # Set the query window to all of time to ensure we get the event we stored.
        self.start = datetime.fromtimestamp(0)
        self.end = datetime.fromtimestamp(3000000000)

    # XXX: Modify this so it's within 90 days of today.
    @freeze_time("2025-07-01 12:00:00")
    def test_within_retention_static(self):
        event_data = load_data(
            "transaction-n-plus-one",
            timestamp=before_now(seconds=20),
            start_timestamp=before_now(seconds=21),
            event_id="a" * 32,
        )
        perf_event = self.create_performance_issue(event_data=event_data)
        stored_event = get_oldest_or_latest_event(
            group=perf_event.group,
            ordering=EventOrdering.LATEST,
            start=self.start,
            end=self.end,
        )
        assert stored_event
        # XXX: When within retention, the perf_event and stored event match timestamps.
        # They also both respect the freeze_time values and fetching the latest event works.
        assert stored_event.timestamp.startswith("2025-07-01")
        assert perf_event.group.get_latest_event() is not None
        assert stored_event.timestamp == perf_event.timestamp

    @freeze_time()
    def test_within_retention_dynamic(self):
        event_data = load_data(
            "transaction-n-plus-one",
            timestamp=before_now(seconds=20),
            start_timestamp=before_now(seconds=21),
            event_id="a" * 32,
        )
        perf_event = self.create_performance_issue(event_data=event_data)
        stored_event = get_oldest_or_latest_event(
            group=perf_event.group,
            ordering=EventOrdering.LATEST,
            start=self.start,
            end=self.end,
        )
        assert stored_event
        assert stored_event.timestamp.startswith(datetime.now().strftime("%Y-%m-%d"))
        assert perf_event.group.get_latest_event() is not None
        # XXX: When within retention, but dynamic freeze_time() value, only the precision is different
        assert stored_event.timestamp == perf_event.timestamp

    @freeze_time("2025-02-14 12:00:00")
    def test_outside_retention(self):
        event_data = load_data(
            "transaction-n-plus-one",
            timestamp=before_now(seconds=20),
            start_timestamp=before_now(seconds=21),
            event_id="a" * 32,
        )
        perf_event = self.create_performance_issue(event_data=event_data)
        stored_event = get_oldest_or_latest_event(
            group=perf_event.group,
            ordering=EventOrdering.LATEST,
            start=self.start,
            end=self.end,
        )
        assert stored_event

        # XXX: All of these assertions will fail :(
        # The stored event is not respecting freeze_time, and instead uses the current time.
        assert stored_event.timestamp.startswith("2025-02-14")
        # This also means fetching the latest event returns empty, since by default, this query is from epoch to now,
        # and the now() is calculated with freeze_time.
        assert perf_event.group.get_latest_event() is not None
        # The stored event timestamp and perf_event timestamp have different precision.
        assert stored_event.timestamp == perf_event.timestamp

from __future__ import annotations

from time import time
from unittest.mock import MagicMock, patch

from sentry.event_manager import EventManager
from sentry.grouping.ingest import _calculate_background_grouping
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
class BackgroundGroupingTest(TestCase):
    @patch(
        "sentry.grouping.ingest._calculate_background_grouping",
        wraps=_calculate_background_grouping,
    )
    def test_applies_background_grouping(self, mock_calc_background_grouping: MagicMock) -> None:
        manager = EventManager({"message": "foo 123"})
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": "mobile:2021-02-12",
                "store.background-grouping-sample-rate": 1.0,
            }
        ):
            manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 1

    @patch("sentry_sdk.capture_exception")
    def test_handles_errors_with_background_grouping(
        self, mock_capture_exception: MagicMock
    ) -> None:
        background_grouping_error = Exception("nope")

        with patch(
            "sentry.grouping.ingest._calculate_background_grouping",
            side_effect=background_grouping_error,
        ):
            manager = EventManager({"message": "foo 123"})
            manager.normalize()
            event = manager.save(self.project.id)

            with self.options(
                {
                    "store.background-grouping-config-id": "mobile:2021-02-12",
                    "store.background-grouping-sample-rate": 1.0,
                }
            ):
                manager.save(self.project.id)

            mock_capture_exception.assert_called_with(background_grouping_error)
            # This proves the background grouping crash didn't crash the overall grouping process
            assert event.group

    @patch("sentry.grouping.ingest._calculate_background_grouping")
    def test_background_grouping_can_be_disabled_via_sample_rate(
        self, mock_calc_background_grouping: MagicMock
    ) -> None:
        manager = EventManager({"message": "foo 123"})
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": "mobile:2021-02-12",
                "store.background-grouping-sample-rate": 0.0,
            }
        ):
            manager.save(self.project.id)

        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0


@region_silo_test
class SecondaryGroupingTest(TestCase):
    def test_applies_secondary_grouping(self):
        project = self.project
        project.update_option("sentry:grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", 0)

        timestamp = time() - 300
        manager = EventManager(
            make_event(message="foo 123", event_id="a" * 32, timestamp=timestamp)
        )
        manager.normalize()
        event = manager.save(project.id)

        project.update_option("sentry:grouping_config", "newstyle:2023-01-11")
        project.update_option("sentry:secondary_grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", time() + (24 * 90 * 3600))

        # Switching to newstyle grouping changes hashes as 123 will be removed
        manager = EventManager(
            make_event(message="foo 123", event_id="b" * 32, timestamp=timestamp + 2.0)
        )
        manager.normalize()

        with self.tasks():
            event2 = manager.save(project.id)

        # make sure that events did get into same group because of fallback grouping, not because of hashes which come from primary grouping only
        assert not set(event.get_hashes().hashes) & set(event2.get_hashes().hashes)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime
        assert group.message == event2.message
        assert group.data.get("type") == "default"
        assert group.data.get("metadata").get("title") == "foo 123"

        # After expiry, new events are still assigned to the same group:
        project.update_option("sentry:secondary_grouping_expiry", 0)
        manager = EventManager(
            make_event(message="foo 123", event_id="c" * 32, timestamp=timestamp + 4.0)
        )
        manager.normalize()

        with self.tasks():
            event3 = manager.save(project.id)
        assert event3.group_id == event2.group_id

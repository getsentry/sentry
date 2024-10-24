from __future__ import annotations

from time import time
from unittest.mock import MagicMock, patch

from sentry.event_manager import EventManager
from sentry.grouping.ingest.hashing import (
    _calculate_background_grouping,
    _calculate_event_grouping,
    _calculate_secondary_hashes,
)
from sentry.models.group import Group
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG, LEGACY_GROUPING_CONFIG
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class BackgroundGroupingTest(TestCase):
    @patch(
        "sentry.grouping.ingest.hashing._calculate_background_grouping",
        wraps=_calculate_background_grouping,
    )
    def test_applies_background_grouping(self, mock_calc_background_grouping: MagicMock) -> None:
        manager = EventManager({"message": "foo 123"})
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": LEGACY_GROUPING_CONFIG,
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
            "sentry.grouping.ingest.hashing._calculate_background_grouping",
            side_effect=background_grouping_error,
        ):
            manager = EventManager({"message": "foo 123"})
            manager.normalize()
            event = manager.save(self.project.id)

            with self.options(
                {
                    "store.background-grouping-config-id": LEGACY_GROUPING_CONFIG,
                    "store.background-grouping-sample-rate": 1.0,
                }
            ):
                manager.save(self.project.id)

            mock_capture_exception.assert_called_with(background_grouping_error)
            # This proves the background grouping crash didn't crash the overall grouping process
            assert event.group

    @patch("sentry.grouping.ingest.hashing._calculate_background_grouping")
    def test_background_grouping_can_be_disabled_via_sample_rate(
        self, mock_calc_background_grouping: MagicMock
    ) -> None:
        manager = EventManager({"message": "foo 123"})
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": LEGACY_GROUPING_CONFIG,
                "store.background-grouping-sample-rate": 0.0,
            }
        ):
            manager.save(self.project.id)

        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0


class SecondaryGroupingTest(TestCase):
    def test_applies_secondary_grouping(self):
        project = self.project
        project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

        timestamp = time()
        manager = EventManager({"message": "foo 123", "timestamp": timestamp})
        manager.normalize()
        event = manager.save(project.id)

        project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_config", LEGACY_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_expiry", timestamp + 3600)

        # Switching to newstyle grouping changes the hash because now '123' will be parametrized
        manager = EventManager({"message": "foo 123", "timestamp": timestamp + 2.0})
        manager.normalize()
        # We need `self.tasks` here because updating group metadata normally happens async
        with self.tasks():
            event2 = manager.save(project.id)

        # Make sure that events did get into same group because of fallback grouping, not because of
        # hashes which come from primary grouping only
        assert not set(event.get_hashes()) & set(event2.get_hashes())
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime
        assert group.message == event2.message
        assert group.data["type"] == "default"
        assert group.data["metadata"]["title"] == "foo 123"

        # After expiry, new events are still assigned to the same group
        project.update_option("sentry:secondary_grouping_expiry", 0)
        manager = EventManager({"message": "foo 123"})
        manager.normalize()

        with self.tasks():
            event3 = manager.save(project.id)
        assert event3.group_id == event2.group_id

    @patch("sentry_sdk.capture_exception")
    @patch(
        "sentry.grouping.ingest.hashing._calculate_secondary_hashes",
        wraps=_calculate_secondary_hashes,
    )
    def test_handles_errors_with_secondary_grouping(
        self,
        mock_calculate_secondary_hash: MagicMock,
        mock_capture_exception: MagicMock,
    ) -> None:
        secondary_grouping_error = Exception("nope")
        secondary_grouping_config = LEGACY_GROUPING_CONFIG

        def mock_calculate_event_grouping(project, event, grouping_config):
            # We only want `_calculate_event_grouping` to error inside of `_calculate_secondary_hash`,
            # not anywhere else it's called
            if grouping_config["id"] == secondary_grouping_config:
                raise secondary_grouping_error
            else:
                return _calculate_event_grouping(project, event, grouping_config)

        project = self.project
        project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_config", secondary_grouping_config)
        project.update_option("sentry:secondary_grouping_expiry", time() + 3600)

        with patch(
            "sentry.grouping.ingest.hashing._calculate_event_grouping",
            wraps=mock_calculate_event_grouping,
        ):
            manager = EventManager({"message": "foo 123"})
            manager.normalize()
            event = manager.save(self.project.id)

            assert mock_calculate_secondary_hash.call_count == 1
            mock_capture_exception.assert_called_with(secondary_grouping_error)
            # This proves the secondary grouping crash didn't crash the overall grouping process
            assert event.group

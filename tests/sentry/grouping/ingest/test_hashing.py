from __future__ import annotations

from time import time
from unittest.mock import MagicMock, patch

from sentry.grouping.ingest.hashing import _calculate_event_grouping, _calculate_secondary_hashes
from sentry.models.group import Group
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG, LEGACY_GROUPING_CONFIG
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class BackgroundGroupingTest(TestCase):
    @override_options({"store.background-grouping-config-id": LEGACY_GROUPING_CONFIG})
    @patch("sentry.grouping.ingest.hashing._calculate_background_grouping")
    def test_background_grouping_sample_rate(
        self, mock_calc_background_grouping: MagicMock
    ) -> None:
        with override_options({"store.background-grouping-sample-rate": 0.0}):
            save_new_event({"message": "Dogs are great! 1231"}, self.project)
            assert mock_calc_background_grouping.call_count == 0

        with override_options({"store.background-grouping-sample-rate": 1.0}):
            save_new_event({"message": "Dogs are great! 1121"}, self.project)
            assert mock_calc_background_grouping.call_count == 1

    @override_options({"store.background-grouping-config-id": LEGACY_GROUPING_CONFIG})
    @override_options({"store.background-grouping-sample-rate": 1.0})
    @patch("sentry_sdk.capture_exception")
    def test_handles_errors_with_background_grouping(
        self, mock_capture_exception: MagicMock
    ) -> None:
        background_grouping_error = Exception("nope")

        with patch(
            "sentry.grouping.ingest.hashing._calculate_background_grouping",
            side_effect=background_grouping_error,
        ):
            event = save_new_event({"message": "Dogs are great! 1231"}, self.project)

            mock_capture_exception.assert_called_with(background_grouping_error)
            # This proves the background grouping crash didn't crash the overall grouping process
            assert event.group


class SecondaryGroupingTest(TestCase):
    def test_applies_secondary_grouping(self):
        project = self.project
        project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

        event = save_new_event({"message": "Dogs are great! 1121"}, project)

        project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_config", LEGACY_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_expiry", time() + 3600)

        # Switching to newstyle grouping changes the hash because now '123' will be parametrized
        event2 = save_new_event({"message": "Dogs are great! 1121"}, project)

        # Make sure that events did get into same group because of secondary grouping, not because
        # of hashes which come from primary grouping only
        assert not set(event.get_hashes()) & set(event2.get_hashes())
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime
        assert group.message == event2.message
        assert group.data["type"] == "default"
        assert group.data["metadata"]["title"] == "Dogs are great! 1121"

        # After expiry, new events are still assigned to the same group
        project.update_option("sentry:secondary_grouping_expiry", 0)
        event3 = save_new_event({"message": "Dogs are great! 1121"}, project)
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

        def mock_calculate_event_grouping(project, event, grouping_config):
            # We only want `_calculate_event_grouping` to error inside of `_calculate_secondary_hash`,
            # not anywhere else it's called
            if grouping_config["id"] == LEGACY_GROUPING_CONFIG:
                raise secondary_grouping_error
            else:
                return _calculate_event_grouping(project, event, grouping_config)

        project = self.project
        project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_config", LEGACY_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_expiry", time() + 3600)

        with patch(
            "sentry.grouping.ingest.hashing._calculate_event_grouping",
            wraps=mock_calculate_event_grouping,
        ):
            event = save_new_event({"message": "Dogs are great! 1231"}, project)

            assert mock_calculate_secondary_hash.call_count == 1
            mock_capture_exception.assert_called_with(secondary_grouping_error)
            # This proves the secondary grouping crash didn't crash the overall grouping process
            assert event.group

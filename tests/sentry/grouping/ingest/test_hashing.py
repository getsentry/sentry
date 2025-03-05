from __future__ import annotations

from time import time
from unittest.mock import MagicMock, patch

from sentry.grouping.ingest.hashing import (
    _calculate_event_grouping,
    _calculate_secondary_hashes,
    get_or_create_grouphashes,
)
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
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

    @patch("sentry.event_manager.get_or_create_grouphashes", wraps=get_or_create_grouphashes)
    def test_secondary_grouphashes_not_saved_when_creating_new_group(
        self, get_or_create_grouphashes_spy: MagicMock
    ):
        project = self.project
        project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_config", LEGACY_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_expiry", time() + 3600)

        # Include a number so the two configs will produce different hashes (since the new config
        # will parameterize the number and the legacy config won't)
        event = save_new_event({"message": "Dogs are great! 1121"}, project)
        assert event.group_id

        assert get_or_create_grouphashes_spy.call_count == 2  # Once for each config

        # Get the hash value for each config by spying on the `get_or_create_grouphashes` function.
        # `call.args[4]` is the grouping config, and `call.args[3]` is the list of hashes. Since
        # we're hashing on message, we know there will only be one hash value in each hash list.
        hashes_by_config = {
            call.args[4]: call.args[3][0] for call in get_or_create_grouphashes_spy.call_args_list
        }

        # The configs produced different hashes...
        assert len(set(hashes_by_config.values())) == 2

        # ...but only the primary config's grouphash is saved
        grouphashes_for_group = GroupHash.objects.filter(project=project, group_id=event.group_id)
        assert grouphashes_for_group.count() == 1
        assert grouphashes_for_group.filter(hash=hashes_by_config[DEFAULT_GROUPING_CONFIG]).exists()
        assert not grouphashes_for_group.filter(
            hash=hashes_by_config[LEGACY_GROUPING_CONFIG]
        ).exists()

    def test_filters_new_secondary_hashes_when_creating_grouphashes(self):
        project = self.project
        project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

        # Include a number so the two configs will produce different hashes (since the new config
        # will parameterize the number and the legacy config won't)
        event1 = save_new_event({"message": "Dogs are great! 1231"}, project)
        legacy_config_hash = event1.get_primary_hash()
        assert set(GroupHash.objects.all().values_list("hash", flat=True)) == {legacy_config_hash}

        # Update the project's grouping config and set it in transition
        project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_config", LEGACY_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_expiry", time() + 3600)

        with (
            patch(
                "sentry.grouping.ingest.hashing._calculate_secondary_hashes",
                return_value=[legacy_config_hash, "new_legacy_hash_value"],
            ),
            patch(
                "sentry.event_manager.get_or_create_grouphashes", wraps=get_or_create_grouphashes
            ) as get_or_create_grouphashes_spy,
        ):
            event2 = save_new_event({"message": "Dogs are great! 1231"}, project)
            default_config_hash = event2.get_primary_hash()
            assert legacy_config_hash != default_config_hash

            # Even though `get_or_create_grouphashes` was called for secondary grouping, no
            # grouphash was created for the new secondary hash "new_legacy_hash_value"
            get_or_create_grouphashes_spy.assert_any_call(
                event2,
                project,
                {},
                [legacy_config_hash, "new_legacy_hash_value"],
                LEGACY_GROUPING_CONFIG,
            )
            assert set(GroupHash.objects.all().values_list("hash", flat=True)) == {
                legacy_config_hash,
                default_config_hash,
            }

from __future__ import annotations

from time import time
from typing import Any
from unittest import mock
from unittest.mock import MagicMock

from sentry.grouping.result import CalculatedHashes
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


LEGACY_CONFIG = "legacy:2019-03-12"
NEWSTYLE_CONFIG = "newstyle:2023-01-11"


def get_relevant_metrics_calls(mock_fn: MagicMock, key: str) -> list[mock._Call]:
    return [call for call in mock_fn.call_args_list if call.args[0] == key]


@region_silo_test
class EventManagerGroupingTest(TestCase):
    def test_puts_events_with_matching_fingerprints_in_same_group(self):
        event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["maisey"]}, self.project
        )
        # Normally this should go into a different group, since the messages don't match, but the
        # fingerprint takes precedence.
        event2 = save_new_event(
            {"message": "Adopt don't shop", "fingerprint": ["maisey"]}, self.project
        )

        assert event.group_id == event2.group_id

    def test_puts_events_with_different_fingerprints_in_different_groups(self):
        event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["maisey"]}, self.project
        )
        # Normally this should go into the same group, since the message matches, but the
        # fingerprint takes precedence.
        event2 = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["charlie"]}, self.project
        )

        assert event.group_id != event2.group_id

    def test_adds_default_fingerprint_if_none_in_event(self):
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        assert event.data.get("fingerprint") == ["{{ default }}"]

    def test_ignores_fingerprint_on_transaction_event(self):
        error_event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["charlie"]}, self.project
        )
        transaction_event = save_new_event(
            {
                "transaction": "dogpark",
                "fingerprint": ["charlie"],
                "type": "transaction",
                "contexts": {
                    "trace": {
                        "parent_span_id": "1121201212312012",
                        "op": "sniffing",
                        "trace_id": "11212012123120120415201309082013",
                        "span_id": "1231201211212012",
                    }
                },
                "start_timestamp": time(),
                "timestamp": time(),
            },
            self.project,
        )

        # Events are assigned to different groups even though they had identical fingerprints
        assert error_event.group_id != transaction_event.group_id

    def test_none_exception(self):
        """Test that when the exception is None, the group is still formed."""
        event = save_new_event({"exception": None}, self.project)

        assert event.group

    def test_updates_group_metadata(self):
        event1 = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["maisey"]}, self.project
        )

        group = Group.objects.get(id=event1.group_id)

        assert group.times_seen == 1
        assert group.last_seen == event1.datetime
        assert group.message == event1.message

        # Normally this should go into a different group, since the messages don't match, but the
        # fingerprint takes precedence. (We need to make the messages different in order to show
        # that the group's message gets updated.)
        event2 = save_new_event(
            {"message": "Adopt don't shop", "fingerprint": ["maisey"]}, self.project
        )

        assert event1.group_id == event2.group_id
        group = Group.objects.get(id=event2.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime
        assert group.message == event2.message


@region_silo_test
class EventManagerGroupingMetricsTest(TestCase):
    @mock.patch("sentry.event_manager.metrics.incr")
    def test_records_avg_calculations_per_event_metrics(self, mock_metrics_incr: MagicMock):
        project = self.project

        cases: list[Any] = [
            [LEGACY_CONFIG, None, None, 1],
            [NEWSTYLE_CONFIG, LEGACY_CONFIG, time() + 3600, 2],
        ]

        for primary_config, secondary_config, transition_expiry, expected_total_calcs in cases:
            mock_metrics_incr.reset_mock()

            project.update_option("sentry:grouping_config", primary_config)
            project.update_option("sentry:secondary_grouping_config", secondary_config)
            project.update_option("sentry:secondary_grouping_expiry", transition_expiry)

            save_new_event({"message": "Dogs are great!"}, self.project)

            total_calculations_calls = get_relevant_metrics_calls(
                mock_metrics_incr, "grouping.total_calculations"
            )
            assert len(total_calculations_calls) == 1
            assert total_calculations_calls[0].kwargs["amount"] == expected_total_calcs
            assert set(total_calculations_calls[0].kwargs["tags"].keys()) == {
                "in_transition",
                "using_transition_optimization",
                "result",
            }

            event_hashes_calculated_calls = get_relevant_metrics_calls(
                mock_metrics_incr, "grouping.event_hashes_calculated"
            )
            assert len(event_hashes_calculated_calls) == 1
            assert set(event_hashes_calculated_calls[0].kwargs["tags"].keys()) == {
                "in_transition",
                "using_transition_optimization",
                "result",
            }

    @mock.patch("sentry.event_manager.metrics.incr")
    def test_adds_correct_tags_to_avg_calculations_per_event_metrics(
        self, mock_metrics_incr: MagicMock
    ):
        project = self.project

        in_transition_cases: list[Any] = [
            [LEGACY_CONFIG, None, None, "False"],  # Not in transition
            [NEWSTYLE_CONFIG, LEGACY_CONFIG, time() + 3600, "True"],  # In transition
        ]
        optimized_logic_cases = [
            [True, "True"],
            [False, "False"],
        ]

        for (
            primary_config,
            secondary_config,
            transition_expiry,
            expected_in_transition,
        ) in in_transition_cases:
            for has_flag, expected_using_optimization in optimized_logic_cases:
                with self.feature(
                    {"organizations:grouping-suppress-unnecessary-secondary-hash": has_flag}
                ):

                    mock_metrics_incr.reset_mock()

                    project.update_option("sentry:grouping_config", primary_config)
                    project.update_option("sentry:secondary_grouping_config", secondary_config)
                    project.update_option("sentry:secondary_grouping_expiry", transition_expiry)

                    save_new_event({"message": "Dogs are great!"}, self.project)

                    # Both metrics get the same tags, so we can check either one
                    total_calculations_calls = get_relevant_metrics_calls(
                        mock_metrics_incr, "grouping.total_calculations"
                    )
                    metric_tags = total_calculations_calls[0].kwargs["tags"]

                    assert len(total_calculations_calls) == 1
                    # The `result` tag is tested in `test_assign_to_group.py`
                    assert metric_tags["in_transition"] == expected_in_transition
                    assert (
                        metric_tags["using_transition_optimization"] == expected_using_optimization
                    )

    @mock.patch("sentry.event_manager.metrics.incr")
    @mock.patch("sentry.grouping.ingest.is_in_transition", return_value=True)
    def test_records_hash_comparison(self, _, mock_metrics_incr: MagicMock):
        project = self.project
        project.update_option("sentry:grouping_config", NEWSTYLE_CONFIG)
        project.update_option("sentry:secondary_grouping_config", LEGACY_CONFIG)

        cases = [
            # primary_hashes, secondary_hashes, expected_tag
            (["maisey"], ["maisey"], "no change"),
            (["maisey"], ["charlie"], "full change"),
            (["maisey", "charlie"], ["maisey", "charlie"], "no change"),
            (["maisey", "charlie"], ["cory", "charlie"], "partial change"),
            (["maisey", "charlie"], ["cory", "bodhi"], "full change"),
        ]

        for primary_hashes, secondary_hashes, expected_tag in cases:
            with mock.patch(
                "sentry.grouping.ingest._calculate_primary_hash",
                return_value=CalculatedHashes(
                    hashes=primary_hashes, hierarchical_hashes=[], tree_labels=[]
                ),
            ):
                with mock.patch(
                    "sentry.grouping.ingest._calculate_secondary_hash",
                    return_value=CalculatedHashes(
                        hashes=secondary_hashes, hierarchical_hashes=[], tree_labels=[]
                    ),
                ):
                    save_new_event({"message": "Dogs are great!"}, self.project)

                    hash_comparison_calls = get_relevant_metrics_calls(
                        mock_metrics_incr, "grouping.hash_comparison"
                    )
                    assert len(hash_comparison_calls) == 1
                    assert hash_comparison_calls[0].kwargs["tags"]["result"] == expected_tag

                    mock_metrics_incr.reset_mock()

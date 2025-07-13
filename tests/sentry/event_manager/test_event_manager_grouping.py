from __future__ import annotations

from time import time
from typing import Any
from unittest import mock
from unittest.mock import ANY, MagicMock, patch

import pytest

from sentry import audit_log
from sentry.conf.server import SENTRY_GROUPING_UPDATE_MIGRATION_PHASE
from sentry.event_manager import _get_updated_group_title
from sentry.eventtypes.base import DefaultEvent
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.grouping.ingest.config import update_or_set_grouping_config_if_needed
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.group import Group
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG, LEGACY_GROUPING_CONFIG
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


def get_relevant_metrics_calls(mock_fn: MagicMock, key: str) -> list[mock._Call]:
    """
    Given a mock metrics function, grab only the calls which record the metric with the given key.
    """
    return [call for call in mock_fn.call_args_list if call.args[0] == key]


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

    def test_puts_events_with_only_partial_message_match_in_different_groups(self):
        # We had a regression which caused the default hash to just be 'event.message' instead of
        # '[event.message]' which caused it to generate a hash per letter
        event1 = save_new_event({"message": "Dogs are great!"}, self.project)
        event2 = save_new_event({"message": "Dogs are really great!"}, self.project)

        assert event1.group_id != event2.group_id

    def test_adds_default_fingerprint_if_none_in_event(self):
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        assert event.data["fingerprint"] == ["{{ default }}"]

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
        assert group.data["metadata"]["title"] == event1.title

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
        assert group.data["metadata"]["title"] == event2.title

    def test_loads_default_config_if_stored_config_option_is_invalid(self):
        self.project.update_option("sentry:grouping_config", "dogs.are.great")
        config_dict = get_grouping_config_dict_for_project(self.project)
        assert config_dict["id"] == DEFAULT_GROUPING_CONFIG

        self.project.update_option("sentry:grouping_config", {"not": "a string"})
        config_dict = get_grouping_config_dict_for_project(self.project)
        assert config_dict["id"] == DEFAULT_GROUPING_CONFIG

    def test_auto_updates_grouping_config_even_if_config_is_gone(self):
        """This tests that setups with deprecated configs will auto-upgrade."""
        self.project.update_option("sentry:grouping_config", "non_existing_config")
        save_new_event({"message": "foo"}, self.project)
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert self.project.get_option("sentry:secondary_grouping_config") is None

    def test_auto_updates_grouping_config(self):
        self.project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

        # Set a platform to prevent platform update audit log entry
        self.project.update(platform="asdf")

        save_new_event({"message": "Adopt don't shop"}, self.project)
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG

        with assume_test_silo_mode_of(AuditLogEntry):
            audit_log_entry = AuditLogEntry.objects.get()

        assert audit_log_entry.event == audit_log.get_event_id("PROJECT_EDIT")
        assert audit_log_entry.actor_label == "Sentry"

        assert audit_log_entry.data == {
            "sentry:grouping_config": DEFAULT_GROUPING_CONFIG,
            "sentry:secondary_grouping_config": LEGACY_GROUPING_CONFIG,
            "sentry:secondary_grouping_expiry": ANY,  # tested separately below
            "id": self.project.id,
            "slug": self.project.slug,
            "name": self.project.name,
            "status": 0,
            "public": False,
        }

        # When the config upgrade is actually happening, the expiry value is set before the
        # audit log entry is created, which means the expiry is based on a timestamp
        # ever-so-slightly before the audit log entry's timestamp, making a one-second tolerance
        # necessary.
        actual_expiry = audit_log_entry.data["sentry:secondary_grouping_expiry"]
        expected_expiry = (
            int(audit_log_entry.datetime.timestamp()) + SENTRY_GROUPING_UPDATE_MIGRATION_PHASE
        )
        assert actual_expiry == expected_expiry or actual_expiry == expected_expiry - 1

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_sets_default_grouping_config_project_option_if_missing(
        self, update_config_spy: MagicMock
    ):
        # To start, the project defaults to the current config but doesn't have its own config
        # option set in the DB
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert (
            ProjectOption.objects.filter(
                project_id=self.project.id, key="sentry:grouping_config"
            ).first()
            is None
        )

        save_new_event({"message": "Dogs are great!"}, self.project)

        update_config_spy.assert_called_with(self.project, "ingest")

        # After the function has been called, the config still defaults to the current one (and no
        # transition has started), but the project now has its own config record in the DB
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert self.project.get_option("sentry:secondary_grouping_config") is None
        assert self.project.get_option("sentry:secondary_grouping_expiry") == 0
        assert ProjectOption.objects.filter(
            project_id=self.project.id, key="sentry:grouping_config"
        ).exists()

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_no_ops_if_grouping_config_project_option_exists_and_is_current(
        self, update_config_spy: MagicMock
    ):
        self.project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)

        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert ProjectOption.objects.filter(
            project_id=self.project.id, key="sentry:grouping_config"
        ).exists()

        save_new_event({"message": "Dogs are great!"}, self.project)

        update_config_spy.assert_called_with(self.project, "ingest")

        # After the function has been called, the config still defaults to the current one and no
        # transition has started
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert self.project.get_option("sentry:secondary_grouping_config") is None
        assert self.project.get_option("sentry:secondary_grouping_expiry") == 0


class PlaceholderTitleTest(TestCase):
    """
    Tests for a bug where error events were interpreted as default-type events and therefore all
    came out with a placeholder title.
    """

    def test_fixes_broken_title_data(self):
        # An event before the bug was introduced
        event1 = save_new_event(
            {
                "exception": {
                    "values": [{"type": "DogsAreNeverAnError", "value": "Dogs are great!"}],
                },
                # Use a fingerprint to guarantee all events end up in the same group
                "fingerprint": ["adopt don't shop"],
            },
            self.project,
        )

        group = Group.objects.get(id=event1.group_id)

        assert group.title == event1.title == "DogsAreNeverAnError: Dogs are great!"
        assert group.data["title"] == event1.data["title"] == "DogsAreNeverAnError: Dogs are great!"
        assert group.data["metadata"].get("title") is event1.data["metadata"].get("title") is None
        assert group.message == "Dogs are great! DogsAreNeverAnError"

        # Simulate the bug
        with mock.patch(
            "sentry.event_manager.get_event_type",
            return_value=DefaultEvent(),
        ):
            # Neutralize the data fixes by making them unable to recognize a bad title and by
            # unconditionally using the incoming title
            with (
                mock.patch(
                    "sentry.event_manager._is_placeholder_title",
                    return_value=False,
                ),
                mock.patch(
                    "sentry.event_manager._get_updated_group_title",
                    new=lambda existing_container, incoming_container: incoming_container.get(
                        "title"
                    ),
                ),
            ):
                event2 = save_new_event(
                    {
                        "exception": {
                            "values": [{"type": "DogsAreNeverAnError", "value": "Maisey is silly"}],
                        },
                        "fingerprint": ["adopt don't shop"],
                    },
                    self.project,
                )

        assert event2.group_id == event1.group_id

        # Pull the group again to get updated data
        group = Group.objects.get(id=event2.group_id)

        # As expected, without the fixes, the bug screws up both the event and group data. (Compare
        # this to the next test, where the fixes are left in place, and the group remains untouched.)
        assert group.title == event2.title == "<unlabeled event>"
        assert group.data["title"] == event2.data["title"] == "<unlabeled event>"
        assert (
            group.data["metadata"]["title"]
            == event2.data["metadata"]["title"]
            == "<unlabeled event>"
        )
        assert group.message == "<unlabeled event>"

        # Now that we have a group with bad data, return to the current world - where the bug has
        # been fixed and the data fix is also in place - and we can see that the group's data
        # returns to what it should be
        event3 = save_new_event(
            {
                "exception": {
                    "values": [{"type": "DogsAreNeverAnError", "value": "Charlie is goofy"}],
                },
                "fingerprint": ["adopt don't shop"],
            },
            self.project,
        )

        assert event3.group_id == event2.group_id == event1.group_id

        # Pull the group again to get updated data
        group = Group.objects.get(id=event3.group_id)

        # Title data is updated with values from newest event, and is back to the structure it was
        # before the bug
        assert group.title == event3.title == "DogsAreNeverAnError: Charlie is goofy"
        assert (
            group.data["title"] == event3.data["title"] == "DogsAreNeverAnError: Charlie is goofy"
        )
        assert group.data["metadata"].get("title") is event3.data["metadata"].get("title") is None
        assert group.message == "Charlie is goofy DogsAreNeverAnError"

    # This is the same as the data-fixing test above, except that the fix is left in place when
    # the bug happens, and so the bad titles never get saved on the group
    def test_bug_regression_no_longer_breaks_titles(self):
        # An event before the bug was introduced
        event1 = save_new_event(
            {
                "exception": {
                    "values": [{"type": "DogsAreNeverAnError", "value": "Dogs are great!"}],
                },
                # Use a fingerprint to guarantee all events end up in the same group
                "fingerprint": ["adopt don't shop"],
            },
            self.project,
        )

        group = Group.objects.get(id=event1.group_id)

        assert group.title == event1.title == "DogsAreNeverAnError: Dogs are great!"
        assert group.data["title"] == event1.data["title"] == "DogsAreNeverAnError: Dogs are great!"
        assert group.data["metadata"].get("title") is event1.data["metadata"].get("title") is None
        assert group.message == "Dogs are great! DogsAreNeverAnError"

        # Simulate the bug, but with the fix in place
        with mock.patch(
            "sentry.event_manager.get_event_type",
            return_value=DefaultEvent(),
        ):
            event2 = save_new_event(
                {
                    "exception": {
                        "values": [{"type": "DogsAreNeverAnError", "value": "Maisey is silly"}],
                    },
                    "fingerprint": ["adopt don't shop"],
                },
                self.project,
            )

        assert event2.group_id == event1.group_id

        # Pull the group again to get updated data
        group = Group.objects.get(id=event2.group_id)

        # The event may be messed up, but it didn't mess up the group
        assert event2.title == "<unlabeled event>"
        assert group.title == "DogsAreNeverAnError: Dogs are great!"
        assert event2.data["title"] == "<unlabeled event>"
        assert group.data["title"] == "DogsAreNeverAnError: Dogs are great!"
        assert group.data["metadata"].get("title") is None
        assert event2.data["metadata"]["title"] == "<unlabeled event>"
        assert group.message == "Dogs are great! DogsAreNeverAnError"

        # An event after the bug was fixed
        event3 = save_new_event(
            {
                "exception": {
                    "values": [{"type": "DogsAreNeverAnError", "value": "Charlie is goofy"}],
                },
                "fingerprint": ["adopt don't shop"],
            },
            self.project,
        )

        assert event3.group_id == event2.group_id == event1.group_id

        # Pull the group again to get updated data
        group = Group.objects.get(id=event3.group_id)

        # Title data is updated with values from newest event
        assert group.title == event3.title == "DogsAreNeverAnError: Charlie is goofy"
        assert (
            group.data["title"] == event3.data["title"] == "DogsAreNeverAnError: Charlie is goofy"
        )
        assert group.data["metadata"].get("title") is event3.data["metadata"].get("title") is None
        assert group.message == "Charlie is goofy DogsAreNeverAnError"


@django_db_all
@pytest.mark.parametrize(
    ["existing_title", "incoming_title", "expected_title"],
    [
        ("Dogs are great!", "Adopt don't shop", "Adopt don't shop"),
        ("Dogs are great!", "<untitled>", "Dogs are great!"),
        ("Dogs are great!", None, "Dogs are great!"),
        ("<unlabeled event>", "Adopt don't shop", "Adopt don't shop"),
        ("<unlabeled event>", "<untitled>", "<untitled>"),
        ("<unlabeled event>", None, None),
        (None, "Adopt don't shop", "Adopt don't shop"),
        (None, "<untitled>", None),
        (None, None, None),
    ],
)
def test_get_updated_group_title(existing_title, incoming_title, expected_title):
    existing_data = {"title": existing_title} if existing_title is not None else {}
    incoming_data = {"title": incoming_title} if incoming_title is not None else {}

    assert _get_updated_group_title(existing_data, incoming_data) == expected_title


class EventManagerGroupingMetricsTest(TestCase):
    @mock.patch("sentry.event_manager.metrics.incr")
    def test_records_avg_calculations_per_event_metrics(self, mock_metrics_incr: MagicMock):
        project = self.project

        cases: list[Any] = [
            ["Dogs are great!", LEGACY_GROUPING_CONFIG, None, None, 1],
            ["Adopt don't shop", DEFAULT_GROUPING_CONFIG, LEGACY_GROUPING_CONFIG, time() + 3600, 2],
        ]

        for (
            message,
            primary_config,
            secondary_config,
            transition_expiry,
            expected_total_calcs,
        ) in cases:
            mock_metrics_incr.reset_mock()

            project.update_option("sentry:grouping_config", primary_config)
            project.update_option("sentry:secondary_grouping_config", secondary_config)
            project.update_option("sentry:secondary_grouping_expiry", transition_expiry)

            save_new_event({"message": message}, self.project)

            total_calculations_calls = get_relevant_metrics_calls(
                mock_metrics_incr, "grouping.total_calculations"
            )
            assert len(total_calculations_calls) == 1
            assert total_calculations_calls[0].kwargs["amount"] == expected_total_calcs
            assert set(total_calculations_calls[0].kwargs["tags"].keys()) == {
                "in_transition",
                "result",
            }

            event_hashes_calculated_calls = get_relevant_metrics_calls(
                mock_metrics_incr, "grouping.event_hashes_calculated"
            )
            assert len(event_hashes_calculated_calls) == 1
            assert set(event_hashes_calculated_calls[0].kwargs["tags"].keys()) == {
                "in_transition",
                "result",
            }

    @mock.patch("sentry.event_manager.metrics.incr")
    def test_adds_correct_tags_to_avg_calculations_per_event_metrics(
        self, mock_metrics_incr: MagicMock
    ):
        project = self.project

        in_transition_cases: list[Any] = [
            [LEGACY_GROUPING_CONFIG, None, None, "False"],  # Not in transition
            [
                DEFAULT_GROUPING_CONFIG,
                LEGACY_GROUPING_CONFIG,
                time() + 3600,
                "True",
            ],  # In transition
        ]

        for (
            primary_config,
            secondary_config,
            transition_expiry,
            expected_in_transition,
        ) in in_transition_cases:

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


@django_db_all
@pytest.mark.parametrize(
    ["primary_hashes", "secondary_hashes", "expected_tag"],
    [
        (["maisey"], ["maisey"], "no change"),
        (["maisey"], ["charlie"], "full change"),
        (["maisey", "charlie"], ["maisey", "charlie"], "no change"),
        (["maisey", "charlie"], ["cory", "charlie"], "partial change"),
        (["maisey", "charlie"], ["cory", "bodhi"], "full change"),
    ],
)
@mock.patch("sentry.event_manager.metrics.incr")
def test_records_hash_comparison_metric(
    mock_metrics_incr: MagicMock,
    primary_hashes: list[str],
    secondary_hashes: list[str],
    expected_tag: str,
    default_project: Project,
):
    project = default_project
    project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)
    project.update_option("sentry:secondary_grouping_config", LEGACY_GROUPING_CONFIG)
    project.update_option("sentry:secondary_grouping_expiry", time() + 3600)

    with mock.patch(
        "sentry.grouping.ingest.hashing._calculate_primary_hashes_and_variants",
        return_value=(primary_hashes, {}),
    ):
        with mock.patch(
            "sentry.grouping.ingest.hashing._calculate_secondary_hashes",
            return_value=secondary_hashes,
        ):
            save_new_event({"message": "Dogs are great!"}, project)

            hash_comparison_calls = get_relevant_metrics_calls(
                mock_metrics_incr, "grouping.hash_comparison"
            )
            assert len(hash_comparison_calls) == 1
            assert hash_comparison_calls[0].kwargs["tags"]["result"] == expected_tag

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from time import time
from typing import Any
from unittest import mock
from unittest.mock import ANY, MagicMock, patch

import pytest
from django.core.cache import cache

from sentry import audit_log
from sentry.conf.server import DEFAULT_GROUPING_CONFIG, SENTRY_GROUPING_CONFIG_TRANSITION_DURATION
from sentry.event_manager import _get_updated_group_title
from sentry.eventtypes.base import DefaultEvent
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.grouping.ingest.caching import (
    get_grouphash_existence_cache_key,
    get_grouphash_object_cache_key,
)
from sentry.grouping.ingest.config import update_or_set_grouping_config_if_needed
from sentry.grouping.ingest.hashing import _get_cache_expiry, get_or_create_grouphashes
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.pytest.mocking import count_matching_calls
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from tests.sentry.grouping import NO_MSG_PARAM_CONFIG

pytestmark = [requires_snuba]


def get_relevant_metrics_calls(mock_fn: MagicMock, key: str) -> list[mock._Call]:
    """
    Given a mock metrics function, grab only the calls which record the metric with the given key.
    """
    return [call for call in mock_fn.call_args_list if call.args[0] == key]


class EventManagerGroupingTest(TestCase):
    def test_puts_events_with_matching_fingerprints_in_same_group(self) -> None:
        event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["maisey"]}, self.project
        )
        # Normally this should go into a different group, since the messages don't match, but the
        # fingerprint takes precedence.
        event2 = save_new_event(
            {"message": "Adopt don't shop", "fingerprint": ["maisey"]}, self.project
        )

        assert event.group_id == event2.group_id

    def test_puts_events_with_different_fingerprints_in_different_groups(self) -> None:
        event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["maisey"]}, self.project
        )
        # Normally this should go into the same group, since the message matches, but the
        # fingerprint takes precedence.
        event2 = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["charlie"]}, self.project
        )

        assert event.group_id != event2.group_id

    def test_puts_events_with_only_partial_message_match_in_different_groups(self) -> None:
        # We had a regression which caused the default hash to just be 'event.message' instead of
        # '[event.message]' which caused it to generate a hash per letter
        event1 = save_new_event({"message": "Dogs are great!"}, self.project)
        event2 = save_new_event({"message": "Dogs are really great!"}, self.project)

        assert event1.group_id != event2.group_id

    def test_adds_default_fingerprint_if_none_in_event(self) -> None:
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        assert event.data["fingerprint"] == ["{{ default }}"]

    def test_ignores_fingerprint_on_transaction_event(self) -> None:
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

    def test_none_exception(self) -> None:
        """Test that when the exception is None, the group is still formed."""
        event = save_new_event({"exception": None}, self.project)

        assert event.group

    def test_updates_group_metadata(self) -> None:
        event1 = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["maisey"]}, self.project
        )

        assert event1.group_id is not None
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

        assert event1.group_id is not None and event2.group_id is not None
        assert event1.group_id == event2.group_id
        group = Group.objects.get(id=event2.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime
        assert group.message == event2.message
        assert group.data["metadata"]["title"] == event2.title

    def test_loads_default_config_if_stored_config_option_is_invalid(self) -> None:
        self.project.update_option("sentry:grouping_config", "dogs.are.great")
        config_dict = get_grouping_config_dict_for_project(self.project)
        assert config_dict["id"] == DEFAULT_GROUPING_CONFIG

        self.project.update_option("sentry:grouping_config", {"not": "a string"})
        config_dict = get_grouping_config_dict_for_project(self.project)
        assert config_dict["id"] == DEFAULT_GROUPING_CONFIG

    def test_auto_updates_grouping_config_even_if_config_is_gone(self) -> None:
        """This tests that setups with deprecated configs will auto-upgrade."""
        self.project.update_option("sentry:grouping_config", "non_existing_config")
        save_new_event({"message": "foo"}, self.project)
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert self.project.get_option("sentry:secondary_grouping_config") is None

    def test_auto_updates_grouping_config(self) -> None:
        self.project.update_option("sentry:grouping_config", NO_MSG_PARAM_CONFIG)
        # Set platform to prevent additional audit log entry from platform inference
        self.project.platform = "python"
        self.project.save()

        save_new_event({"message": "Adopt don't shop"}, self.project)
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG

        with assume_test_silo_mode_of(AuditLogEntry):
            audit_log_entry = AuditLogEntry.objects.get()

        assert audit_log_entry.event == audit_log.get_event_id("PROJECT_EDIT")
        assert audit_log_entry.actor_label == "Sentry"

        assert audit_log_entry.data == {
            "sentry:grouping_config": DEFAULT_GROUPING_CONFIG,
            "sentry:secondary_grouping_config": NO_MSG_PARAM_CONFIG,
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
            int(audit_log_entry.datetime.timestamp()) + SENTRY_GROUPING_CONFIG_TRANSITION_DURATION
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

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_no_ops_if_sample_rate_test_fails(self, update_config_spy: MagicMock):
        with (
            # Ensure our die roll will fall outside the sample rate
            patch("sentry.grouping.ingest.config.random", return_value=0.1121),
            override_options({"grouping.config_transition.config_upgrade_sample_rate": 0.0908}),
        ):
            self.project.update_option("sentry:grouping_config", NO_MSG_PARAM_CONFIG)
            assert self.project.get_option("sentry:grouping_config") == NO_MSG_PARAM_CONFIG

            save_new_event({"message": "Dogs are great!"}, self.project)

            update_config_spy.assert_called_with(self.project, "ingest")

            # After the function has been called, the config hasn't changed and no transition has
            # started
            assert self.project.get_option("sentry:grouping_config") == NO_MSG_PARAM_CONFIG
            assert self.project.get_option("sentry:secondary_grouping_config") is None
            assert self.project.get_option("sentry:secondary_grouping_expiry") == 0

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_ignores_sample_rate_if_current_config_is_invalid(self, update_config_spy: MagicMock):
        with (
            # Ensure our die roll will fall outside the sample rate
            patch("sentry.grouping.ingest.config.random", return_value=0.1121),
            override_options({"grouping.config_transition.config_upgrade_sample_rate": 0.0908}),
        ):
            self.project.update_option("sentry:grouping_config", "not_a_real_config")
            assert self.project.get_option("sentry:grouping_config") == "not_a_real_config"

            save_new_event({"message": "Dogs are great!"}, self.project)

            update_config_spy.assert_called_with(self.project, "ingest")

            # The config has been updated, but no transition has started because we can't calculate
            # a secondary hash using a config that doesn't exist
            assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
            assert self.project.get_option("sentry:secondary_grouping_config") is None
            assert self.project.get_option("sentry:secondary_grouping_expiry") == 0

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_ignores_sample_rate_if_no_record_exists(self, update_config_spy: MagicMock):
        with (
            # Ensure our die roll will fall outside the sample rate
            patch("sentry.grouping.ingest.config.random", return_value=0.1121),
            override_options({"grouping.config_transition.config_upgrade_sample_rate": 0.0908}),
        ):
            assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
            assert not ProjectOption.objects.filter(
                project_id=self.project.id, key="sentry:grouping_config"
            ).exists()

            save_new_event({"message": "Dogs are great!"}, self.project)

            update_config_spy.assert_called_with(self.project, "ingest")

            # The config hasn't been updated, but now the project has its own record. No transition
            # has started because the config was already up to date.
            assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
            assert ProjectOption.objects.filter(
                project_id=self.project.id, key="sentry:grouping_config"
            ).exists()
            assert self.project.get_option("sentry:secondary_grouping_config") is None
            assert self.project.get_option("sentry:secondary_grouping_expiry") == 0


class GroupHashCachingTest(TestCase):
    @contextmanager
    def mock_irrelevant_helpers(self) -> Generator[None]:
        """
        Patch the helpers called in `get_or_create_grouphashes` so nothing will break when we pass
        dummy values for parameters which are are irrelevant for our tests but used by the helpers.
        """
        with (
            patch(
                "sentry.grouping.ingest.hashing.create_or_update_grouphash_metadata_if_needed",
            ),
            patch(
                "sentry.grouping.ingest.hashing.record_grouphash_metadata_metrics",
            ),
        ):
            yield

    @contextmanager
    def get_spies(self, is_secondary: bool) -> Generator[tuple[MagicMock, MagicMock, MagicMock]]:
        """
        Wrap various caching and database functions in mocks so we can track calls to them.
        """
        with (
            patch(
                "sentry.grouping.ingest.hashing.cache.get",
                wraps=cache.get,
            ) as cache_get_spy,
            patch(
                "sentry.grouping.ingest.hashing.cache.set",
                wraps=cache.set,
            ) as cache_set_spy,
            patch(
                "sentry.grouping.ingest.hashing.GroupHash.objects.filter",
                wraps=GroupHash.objects.filter,
            ) as grouphash_objects_filter_spy,
            patch(
                "sentry.grouping.ingest.hashing.GroupHash.objects.get_or_create",
                wraps=GroupHash.objects.get_or_create,
            ) as grouphash_objects_get_or_create_spy,
        ):
            if is_secondary:
                yield (cache_get_spy, cache_set_spy, grouphash_objects_filter_spy)
            else:
                yield (cache_get_spy, cache_set_spy, grouphash_objects_get_or_create_spy)

    def run_test(
        self,
        grouphash_exists: bool,
        grouphash_has_group: bool,
        is_secondary: bool,
        cache_check_expected: bool,
        cache_use_expected: bool,
    ) -> None:
        """
        For the given setup (defined by `grouphash_exists`, `grouphash_has_group`, and
        `is_secondary`), make sure the right information ends up in the cache (or doesn't) and that
        calls to the cache and calls to the database happen (or don't happen) as we'd expect.
        """
        hash_value = "dogs_are_great"
        event1 = Event(self.project.id, "11212012123120120415201309082013")
        event2 = Event(self.project.id, "04152013090820131121201212312012")

        if grouphash_exists:
            group = self.group if grouphash_has_group else None
            grouphash = GroupHash.objects.create(project=self.project, hash=hash_value, group=group)
            assert GroupHash.objects.filter(project=self.project, hash=hash_value).exists()
        else:
            grouphash = None
            assert not GroupHash.objects.filter(project=self.project, hash=hash_value).exists()

        if is_secondary:
            grouping_config_id = "old_config"
            grouping_config_option = "sentry:secondary_grouping_config"
            cache_key = get_grouphash_existence_cache_key(hash_value, self.project.id)
            # TODO: This can go back to being `options.get("grouping.ingest_grouphash_existence_cache_expiry")`
            # once we've settled on a retention period
            cache_expiry, expiry_option_version = _get_cache_expiry(
                cache_key, cache_type="existence"
            )
            cached_value: Any = grouphash_exists
        else:
            grouping_config_id = "new_config"
            grouping_config_option = "sentry:grouping_config"
            cache_key = get_grouphash_object_cache_key(hash_value, self.project.id)
            # TODO: This can go back to being `options.get("grouping.ingest_grouphash_object_cache_expiry")`
            # once we've settled on a retention period
            cache_expiry, expiry_option_version = _get_cache_expiry(cache_key, cache_type="object")
            cached_value = grouphash

        self.project.update_option(grouping_config_option, grouping_config_id)

        with self.mock_irrelevant_helpers(), self.get_spies(is_secondary) as spies:
            # The database function being spied on is either `GroupHash.objects.filter` (if we're
            # testing secondary grouphash handling) or `GroupHash.objects.get_or_create` (if we're
            # testing grouphash object handling)
            cache_get_spy, cache_set_spy, database_fn_spy = spies
            cache_get_args = [cache_key]
            cache_get_kwargs = {"version": expiry_option_version}
            cache_set_args = [cache_key, cached_value, cache_expiry]
            cache_set_kwargs = {"version": expiry_option_version}
            database_fn_kwargs = {"project": self.project, "hash": hash_value}

            # TODO: this (and the check below) can be simplified to use in/not in once version is gone
            assert not cache.has_key(cache_key, version=expiry_option_version)

            # ######### First call for grouphashes, with a hash we've never seen before ######### #

            get_or_create_grouphashes(event1, self.project, {}, [hash_value], grouping_config_id)

            assert cache.has_key(cache_key, version=expiry_option_version) == cache_use_expected

            cache_get_call_count = count_matching_calls(
                cache_get_spy, *cache_get_args, **cache_get_kwargs
            )
            cache_set_call_count = count_matching_calls(
                cache_set_spy, *cache_set_args, **cache_set_kwargs
            )
            database_fn_call_count = count_matching_calls(database_fn_spy, **database_fn_kwargs)

            assert cache_get_call_count == (1 if cache_check_expected else 0)
            assert cache_set_call_count == (1 if cache_use_expected else 0)
            # The first time we see a particular hash, we have to touch the database regardless
            assert database_fn_call_count == 1

            # ########################## Second call, using the same hash ######################## #

            get_or_create_grouphashes(event2, self.project, {}, [hash_value], grouping_config_id)

            cache_get_call_count = count_matching_calls(
                cache_get_spy, *cache_get_args, **cache_get_kwargs
            )
            cache_set_call_count = count_matching_calls(
                cache_set_spy, *cache_set_args, **cache_set_kwargs
            )
            database_fn_call_count = count_matching_calls(database_fn_spy, **database_fn_kwargs)

            # With caching, call count increases by 1
            assert cache_get_call_count == (2 if cache_check_expected else 0)

            # With caching, neither call count increases, because we found what we needed in the
            # cache. Without caching, we have one more call to the database than before.
            assert cache_set_call_count == (1 if cache_use_expected else 0)
            assert database_fn_call_count == (1 if cache_use_expected else 2)

    def test_handles_existing_secondary_grouphash_with_group(self) -> None:
        # Here we expect the cache to be used for both getting and setting, because for secondary
        # hashes we always use it unless the killswitch is on
        self.run_test(
            grouphash_exists=True,
            grouphash_has_group=True,
            is_secondary=True,
            cache_check_expected=True,
            cache_use_expected=True,
        )

    def test_handles_existing_secondary_grouphash_without_group(self) -> None:
        # Same as above - secondary grouphash cache should always be used unless killswitch is on
        self.run_test(
            grouphash_exists=True,
            grouphash_has_group=False,
            is_secondary=True,
            cache_check_expected=True,
            cache_use_expected=True,
        )

    def test_handles_new_secondary_grouphash(self) -> None:
        # This follows the exact same logic as the `test_handles_existing_secondary_grouphash` test
        # above
        self.run_test(
            grouphash_exists=False,
            grouphash_has_group=False,  # It can't if it doesn't exist yet
            is_secondary=True,
            cache_check_expected=True,
            cache_use_expected=True,
        )

    # Note: In this test and the one immediately below it, we're assuming the grouphash is a primary
    # grouphash. It could also be a secondary one and nothing would change - it was just easier to
    # split the tests up this way.
    def test_handles_existing_grouphash_object_with_group(self) -> None:
        # Here we expect the cache to both be checked and used to store the grouphash, since it has
        # an assigned group.
        self.run_test(
            grouphash_exists=True,
            grouphash_has_group=True,
            is_secondary=False,
            cache_check_expected=True,
            cache_use_expected=True,
        )

    def test_handles_existing_grouphash_object_without_group(self) -> None:
        # Here we expect the cache to be checked but not used to store the grouphash, since it has
        # no assigned group.
        self.run_test(
            grouphash_exists=True,
            grouphash_has_group=False,
            is_secondary=False,
            cache_check_expected=True,
            cache_use_expected=False,
        )

    def test_handles_new_grouphash_object(self) -> None:
        # This follows the exact same logic as  the
        # `test_handles_existing_primary_grouphash_without_group` test above
        self.run_test(
            grouphash_exists=False,
            grouphash_has_group=False,  # It can't if it doesn't exist yet
            is_secondary=False,
            cache_check_expected=True,
            cache_use_expected=False,
        )

    @override_options({"grouping.use_ingest_grouphash_caching": False})
    def test_secondary_grouphash_existence_cache_obeys_killswitch(self) -> None:
        # This test has the same setup as `test_handles_existing_secondary_grouphash_with_group`, so
        # normally we'd expect the cache to be used, but it isn't because of the killswitch
        self.run_test(
            grouphash_exists=True,
            grouphash_has_group=True,
            is_secondary=True,
            cache_check_expected=False,
            cache_use_expected=False,
        )

    @override_options({"grouping.use_ingest_grouphash_caching": False})
    def test_grouphash_object_cache_obeys_killswitch(self) -> None:
        # This test has the same setup as `test_handles_existing_grouphash_object_with_group`, so
        # normally we'd expect the cache to be used, but it isn't because of the killswitch
        self.run_test(
            grouphash_exists=True,
            grouphash_has_group=True,
            is_secondary=False,
            cache_check_expected=False,
            cache_use_expected=False,
        )


class PlaceholderTitleTest(TestCase):
    """
    Tests for a bug where error events were interpreted as default-type events and therefore all
    came out with a placeholder title.
    """

    def test_fixes_broken_title_data(self) -> None:
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

        assert event1.group_id is not None
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

        assert event1.group_id is not None and event2.group_id is not None
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

        assert event1.group_id is not None
        assert event2.group_id is not None
        assert event3.group_id is not None
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
    def test_bug_regression_no_longer_breaks_titles(self) -> None:
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

        assert event1.group_id is not None
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

        assert event1.group_id is not None and event2.group_id is not None
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

        assert event1.group_id is not None
        assert event2.group_id is not None
        assert event3.group_id is not None
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
def test_get_updated_group_title(existing_title, incoming_title, expected_title) -> None:
    existing_data = {"title": existing_title} if existing_title is not None else {}
    incoming_data = {"title": incoming_title} if incoming_title is not None else {}

    assert _get_updated_group_title(existing_data, incoming_data) == expected_title


class EventManagerGroupingMetricsTest(TestCase):
    @mock.patch("sentry.event_manager.metrics.incr")
    def test_records_avg_calculations_per_event_metrics(self, mock_metrics_incr: MagicMock) -> None:
        project = self.project

        cases: list[Any] = [
            ["Dogs are great!", NO_MSG_PARAM_CONFIG, None, None, 1],
            ["Adopt don't shop", DEFAULT_GROUPING_CONFIG, NO_MSG_PARAM_CONFIG, time() + 3600, 2],
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
            [NO_MSG_PARAM_CONFIG, None, None, "False"],  # Not in transition
            [
                DEFAULT_GROUPING_CONFIG,
                NO_MSG_PARAM_CONFIG,
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
    project.update_option("sentry:secondary_grouping_config", NO_MSG_PARAM_CONFIG)
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

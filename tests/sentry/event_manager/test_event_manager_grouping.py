from __future__ import annotations

import logging
import uuid
from time import time
from unittest import mock
from unittest.mock import MagicMock

from sentry import tsdb
from sentry.event_manager import EventManager
from sentry.grouping.result import CalculatedHashes
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.tsdb.base import TSDBModel

pytestmark = [requires_snuba]


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


def get_relevant_metrics_calls(mock_fn: MagicMock, key: str) -> list[mock._Call]:
    return [call for call in mock_fn.call_args_list if call.args[0] == key]


@region_silo_test
class EventManagerGroupingTest(TestCase):
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

    def test_applies_secondary_grouping_hierarchical(self):
        project = self.project
        project.update_option("sentry:grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", 0)

        timestamp = time() - 300

        def save_event(ts_offset):
            ts = timestamp + ts_offset
            manager = EventManager(
                make_event(
                    message="foo 123",
                    event_id=hex(2**127 + int(ts))[-32:],
                    timestamp=ts,
                    exception={
                        "values": [
                            {
                                "type": "Hello",
                                "stacktrace": {
                                    "frames": [
                                        {
                                            "function": "not_in_app_function",
                                        },
                                        {
                                            "function": "in_app_function",
                                        },
                                    ]
                                },
                            }
                        ]
                    },
                )
            )
            manager.normalize()
            with self.tasks():
                return manager.save(project.id)

        event = save_event(0)

        project.update_option("sentry:grouping_config", "mobile:2021-02-12")
        project.update_option("sentry:secondary_grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", time() + (24 * 90 * 3600))

        # Switching to newstyle grouping changes hashes as 123 will be removed
        event2 = save_event(2)

        # make sure that events did get into same group because of fallback grouping, not because of hashes which come from primary grouping only
        assert not set(event.get_hashes().hashes) & set(event2.get_hashes().hashes)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime

        # After expiry, new events are still assigned to the same group:
        project.update_option("sentry:secondary_grouping_expiry", 0)
        event3 = save_event(4)
        assert event3.group_id == event2.group_id

    def test_applies_downgrade_hierarchical(self):
        project = self.project
        project.update_option("sentry:grouping_config", "mobile:2021-02-12")
        project.update_option("sentry:secondary_grouping_expiry", 0)

        timestamp = time() - 300

        def save_event(ts_offset):
            ts = timestamp + ts_offset
            manager = EventManager(
                make_event(
                    message="foo 123",
                    event_id=hex(2**127 + int(ts))[-32:],
                    timestamp=ts,
                    exception={
                        "values": [
                            {
                                "type": "Hello",
                                "stacktrace": {
                                    "frames": [
                                        {
                                            "function": "not_in_app_function",
                                        },
                                        {
                                            "function": "in_app_function",
                                        },
                                    ]
                                },
                            }
                        ]
                    },
                )
            )
            manager.normalize()
            with self.tasks():
                return manager.save(project.id)

        event = save_event(0)

        project.update_option("sentry:grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_config", "mobile:2021-02-12")
        project.update_option("sentry:secondary_grouping_expiry", time() + (24 * 90 * 3600))

        # Switching to newstyle grouping changes hashes as 123 will be removed
        event2 = save_event(2)

        # make sure that events did get into same group because of fallback grouping, not because of hashes which come from primary grouping only
        assert not set(event.get_hashes().hashes) & set(event2.get_hashes().hashes)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        group_hashes = GroupHash.objects.filter(
            project=self.project, hash__in=event.get_hashes().hashes
        )
        assert group_hashes
        for hash in group_hashes:
            assert hash.group_id == event.group_id

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime

        # After expiry, new events are still assigned to the same group:
        project.update_option("sentry:secondary_grouping_expiry", 0)
        event3 = save_event(4)
        assert event3.group_id == event2.group_id

    @mock.patch("sentry.event_manager._calculate_background_grouping")
    def test_applies_background_grouping(self, mock_calc_grouping):
        timestamp = time() - 300
        manager = EventManager(
            make_event(message="foo 123", event_id="a" * 32, timestamp=timestamp)
        )
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": "mobile:2021-02-12",
                "store.background-grouping-sample-rate": 1.0,
            }
        ):
            manager.save(self.project.id)

        assert mock_calc_grouping.call_count == 1

    @mock.patch("sentry.event_manager._calculate_background_grouping")
    def test_background_grouping_sample_rate(self, mock_calc_grouping):
        timestamp = time() - 300
        manager = EventManager(
            make_event(message="foo 123", event_id="a" * 32, timestamp=timestamp)
        )
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": "mobile:2021-02-12",
                "store.background-grouping-sample-rate": 0.0,
            }
        ):
            manager.save(self.project.id)

        manager.save(self.project.id)

        assert mock_calc_grouping.call_count == 0

    def test_puts_events_with_matching_fingerprints_in_same_group(self):
        ts = time() - 200
        manager = EventManager(
            make_event(message="foo", event_id="a" * 32, fingerprint=["a" * 32], timestamp=ts)
        )
        with self.tasks():
            event = manager.save(self.project.id)

        manager = EventManager(
            make_event(message="foo bar", event_id="b" * 32, fingerprint=["a" * 32], timestamp=ts)
        )
        with self.tasks():
            event2 = manager.save(self.project.id)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event.datetime
        assert group.message == event2.message

    def test_puts_events_with_different_fingerprints_in_different_groups(self):
        manager = EventManager(
            make_event(message="foo", event_id="a" * 32, fingerprint=["{{ default }}", "a" * 32])
        )
        with self.tasks():
            manager.normalize()
            event = manager.save(self.project.id)

        manager = EventManager(
            make_event(message="foo bar", event_id="b" * 32, fingerprint=["a" * 32])
        )
        with self.tasks():
            manager.normalize()
            event2 = manager.save(self.project.id)

        assert event.group_id != event2.group_id

    def test_adds_default_fingerprint_if_none_in_event(self):
        manager = EventManager(make_event())
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.data.get("fingerprint") == ["{{ default }}"]

    @freeze_time()
    def test_ignores_fingerprint_on_transaction_event(self):
        manager1 = EventManager(make_event(event_id="a" * 32, fingerprint="fingerprint1"))
        event1 = manager1.save(self.project.id)

        manager2 = EventManager(
            make_event(
                event_id="b" * 32,
                fingerprint="fingerprint1",
                transaction="wait",
                contexts={
                    "trace": {
                        "parent_span_id": "bce14471e0e9654d",
                        "op": "foobar",
                        "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                        "span_id": "bf5be759039ede9a",
                    }
                },
                spans=[],
                timestamp=iso_format(before_now(minutes=1)),
                start_timestamp=iso_format(before_now(minutes=1)),
                type="transaction",
                platform="python",
            )
        )
        event2 = manager2.save(self.project.id)

        assert event1.group is not None
        assert event2.group is None
        assert (
            tsdb.backend.get_sums(
                TSDBModel.project,
                [self.project.id],
                event1.datetime,
                event1.datetime,
                tenant_ids={"organization_id": 123, "referrer": "r"},
            )[self.project.id]
            == 1
        )

        assert (
            tsdb.backend.get_sums(
                TSDBModel.group,
                [event1.group.id],
                event1.datetime,
                event1.datetime,
                tenant_ids={"organization_id": 123, "referrer": "r"},
            )[event1.group.id]
            == 1
        )

    def test_none_exception(self):
        """Test that when the exception is None, the group is still formed."""
        manager = EventManager(
            make_event(
                exception=None,
            )
        )
        with self.tasks():
            manager.normalize()
            event = manager.save(self.project.id)

        assert event.group


@region_silo_test
class EventManagerGroupingMetricsTest(TestCase):
    @mock.patch("sentry.event_manager.metrics.incr")
    def test_records_num_calculations(self, mock_metrics_incr: MagicMock):
        project = self.project
        project.update_option("sentry:grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_config", None)

        manager = EventManager(make_event(message="dogs are great"))
        manager.normalize()
        manager.save(project.id)

        hashes_calculated_calls = get_relevant_metrics_calls(
            mock_metrics_incr, "grouping.hashes_calculated"
        )
        assert len(hashes_calculated_calls) == 1
        assert hashes_calculated_calls[0].kwargs["amount"] == 1

        project.update_option("sentry:grouping_config", "newstyle:2023-01-11")
        project.update_option("sentry:secondary_grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", time() + 3600)

        manager = EventManager(make_event(message="dogs are great"))
        manager.normalize()
        manager.save(project.id)

        hashes_calculated_calls = get_relevant_metrics_calls(
            mock_metrics_incr, "grouping.hashes_calculated"
        )
        assert len(hashes_calculated_calls) == 2
        assert hashes_calculated_calls[1].kwargs["amount"] == 2

    @mock.patch("sentry.event_manager.metrics.incr")
    @mock.patch("sentry.event_manager._should_run_secondary_grouping", return_value=True)
    def test_records_hash_comparison(self, _, mock_metrics_incr: MagicMock):
        project = self.project
        project.update_option("sentry:grouping_config", "newstyle:2023-01-11")
        project.update_option("sentry:secondary_grouping_config", "legacy:2019-03-12")

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
                "sentry.event_manager._calculate_primary_hash",
                return_value=CalculatedHashes(
                    hashes=primary_hashes, hierarchical_hashes=[], tree_labels=[]
                ),
            ):
                with mock.patch(
                    "sentry.event_manager._calculate_secondary_hash",
                    return_value=CalculatedHashes(
                        hashes=secondary_hashes, hierarchical_hashes=[], tree_labels=[]
                    ),
                ):
                    manager = EventManager(make_event(message="dogs are great"))
                    manager.normalize()
                    manager.save(project.id)

                    hash_comparison_calls = get_relevant_metrics_calls(
                        mock_metrics_incr, "grouping.hash_comparison"
                    )
                    assert len(hash_comparison_calls) == 1
                    assert hash_comparison_calls[0].kwargs["tags"]["result"] == expected_tag

                    mock_metrics_incr.reset_mock()

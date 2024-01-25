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
    @mock.patch("sentry.grouping.ingest._should_run_secondary_grouping", return_value=True)
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
                    manager = EventManager(make_event(message="dogs are great"))
                    manager.normalize()
                    manager.save(project.id)

                    hash_comparison_calls = get_relevant_metrics_calls(
                        mock_metrics_incr, "grouping.hash_comparison"
                    )
                    assert len(hash_comparison_calls) == 1
                    assert hash_comparison_calls[0].kwargs["tags"]["result"] == expected_tag

                    mock_metrics_incr.reset_mock()

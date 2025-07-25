"""
Tests for the thread-queue-parallel result consumer implementation.
"""

import threading
import time
from datetime import datetime
from typing import Any
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, FilteredPayload, Message, Partition, Topic

from sentry.conf.types.kafka_definition import Topic as SentryTopic
from sentry.remote_subscriptions.consumers.queue_consumer import (
    FixedQueuePool,
    OffsetTracker,
    SimpleQueueProcessingStrategy,
    WorkItem,
)
from sentry.remote_subscriptions.consumers.result_consumer import (
    ResultProcessor,
    ResultsStrategyFactory,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json


class TestOffsetTracker(TestCase):
    def setUp(self):
        self.partition1 = Partition(Topic("test"), 0)
        self.partition2 = Partition(Topic("test"), 1)
        self.tracker = OffsetTracker()
        self.tracker.update_assignments({self.partition1, self.partition2})

    def test_simple_tracking(self) -> None:
        """Test basic offset tracking and committing."""
        now = datetime.now()
        self.tracker.add_offset(self.partition1, 100, now)
        self.tracker.add_offset(self.partition1, 101, now)
        self.tracker.add_offset(self.partition1, 102, now)

        committable = self.tracker.get_committable_offsets()
        assert committable == {}

        self.tracker.complete_offset(self.partition1, 100)
        committable = self.tracker.get_committable_offsets()
        assert committable == {self.partition1: (100, now)}

        self.tracker.mark_committed(self.partition1, 100)
        self.tracker.complete_offset(self.partition1, 102)
        committable = self.tracker.get_committable_offsets()
        assert committable == {}

        self.tracker.complete_offset(self.partition1, 101)
        committable = self.tracker.get_committable_offsets()
        assert committable == {self.partition1: (102, now)}

    def test_multiple_partitions(self) -> None:
        """Test tracking across multiple partitions."""
        now = datetime.now()
        self.tracker.add_offset(self.partition1, 100, now)
        self.tracker.add_offset(self.partition1, 101, now)
        self.tracker.add_offset(self.partition2, 200, now)
        self.tracker.add_offset(self.partition2, 201, now)

        self.tracker.complete_offset(self.partition1, 100)
        self.tracker.complete_offset(self.partition2, 200)
        self.tracker.complete_offset(self.partition2, 201)

        committable = self.tracker.get_committable_offsets()
        assert committable == {self.partition1: (100, now), self.partition2: (201, now)}


class TestFixedQueuePool(TestCase):
    def setUp(self):
        self.processed_items: list[tuple[str, str]] = []
        self.process_lock = threading.Lock()
        self.process_complete_event = threading.Event()
        self.items_processed = 0
        self.expected_items = 0

        def result_processor(identifier: str, item: str):
            with self.process_lock:
                self.processed_items.append((identifier, item))
                self.items_processed += 1
                if self.items_processed >= self.expected_items:
                    self.process_complete_event.set()

        self.pool = FixedQueuePool(
            result_processor=result_processor,
            identifier="test",
            num_queues=3,
            consumer_group="test",
        )

        self.commits: list[dict[Partition, int]] = []

        def commit_function(offsets: dict[Partition, int]) -> None:
            self.commits.append(offsets.copy())

        test_partitions = {Partition(Topic("test"), i) for i in range(3)}
        self.pool.update_assignments(test_partitions, commit_function)

    def tearDown(self):
        self.pool.shutdown()

    def test_consistent_group_assignment(self) -> None:
        """Test that groups are consistently assigned to the same queue."""
        group_key = "group1"
        queue_index1 = self.pool.get_queue_for_group(group_key)
        queue_index2 = self.pool.get_queue_for_group(group_key)
        queue_index3 = self.pool.get_queue_for_group(group_key)

        assert queue_index1 == queue_index2 == queue_index3

    def test_different_groups_distributed(self) -> None:
        """Test that different groups are distributed across queues."""
        queue_indices = set()
        for i in range(20):
            group_key = f"group{i}"
            queue_index = self.pool.get_queue_for_group(group_key)
            queue_indices.add(queue_index)

        assert len(queue_indices) == 3

    def test_ordered_processing_within_group(self) -> None:
        """Test that items within a group are processed in order."""
        partition = Partition(Topic("test"), 0)
        group_key = "ordered_group"

        self.expected_items = 5
        self.process_complete_event.clear()

        for i in range(5):
            now = datetime.now()
            work_item = WorkItem(
                partition=partition,
                offset=i,
                timestamp=now,
                result=f"item_{i}",
            )
            self.pool.submit(group_key, work_item)

        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"

        group_items = [item for _, item in self.processed_items if item.startswith("item_")]
        assert group_items == ["item_0", "item_1", "item_2", "item_3", "item_4"]

    def test_concurrent_processing_across_groups(self) -> None:
        """Test that different groups are processed concurrently."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 6
        self.process_complete_event.clear()

        for i in range(6):
            group_key = f"group_{i % 3}"
            now = datetime.now()
            work_item = WorkItem(
                partition=partition,
                offset=i,
                timestamp=now,
                result=f"item_{group_key}_{i}",
            )
            self.pool.submit(group_key, work_item)

        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"
        assert len(self.processed_items) == 6

        groups_seen = set()
        for _, item in self.processed_items:
            if item.startswith("item_group_"):
                # Extract the group number (0, 1, or 2)
                parts = item.split("_")
                if len(parts) >= 3:
                    group_num = parts[2]
                    groups_seen.add(group_num)

        assert len(groups_seen) == 3

    def test_stats_reporting(self) -> None:
        """Test queue statistics reporting."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 10
        self.process_complete_event.clear()

        for i in range(10):
            group_key = f"group_{i % 4}"
            now = datetime.now()
            work_item = WorkItem(
                partition=partition,
                offset=i,
                timestamp=now,
                result=f"item_{i}",
            )
            self.pool.submit(group_key, work_item)

        stats = self.pool.get_stats()
        assert stats["total_items"] > 0
        assert "queue_depths" in stats
        assert len(stats["queue_depths"]) == 3
        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"

        stats = self.pool.get_stats()
        assert stats["total_items"] == 0


class TestSimpleQueueProcessingStrategy(TestCase):
    def setUp(self):
        self.processed_results: list[Any] = []
        self.committed_offsets: dict[Partition, int] = {}
        self.process_lock = threading.Lock()
        self.process_complete_event = threading.Event()
        self.commit_event = threading.Event()
        self.items_processed = 0
        self.expected_items = 0

        def result_processor(identifier: str, result: dict):
            with self.process_lock:
                self.processed_results.append(result)
                self.items_processed += 1
                if self.items_processed >= self.expected_items:
                    self.process_complete_event.set()

        self.queue_pool = FixedQueuePool(
            result_processor=result_processor,
            identifier="test",
            num_queues=2,
            consumer_group="test",
        )

        def commit_function(offsets: dict[Partition, int]):
            with self.process_lock:
                self.committed_offsets.update(offsets)
                self.commit_event.set()

        def decoder(payload: KafkaPayload | FilteredPayload) -> dict | None:
            if isinstance(payload, FilteredPayload):
                return None
            return {"subscription_id": payload.value.decode(), "data": "test"}

        def grouping_fn(result: dict) -> str:
            return result["subscription_id"]

        self.test_partitions = {Partition(Topic("test"), i) for i in range(3)}

        self.strategy = SimpleQueueProcessingStrategy(
            queue_pool=self.queue_pool,
            decoder=decoder,
            grouping_fn=grouping_fn,
            commit_function=commit_function,
            partitions=self.test_partitions,
        )

    def tearDown(self):
        self.strategy.close()

    def create_message(self, subscription_id: str, partition: int, offset: int) -> Message:
        payload = KafkaPayload(
            key=None,
            value=subscription_id.encode(),
            headers=[],
        )
        return Message(
            BrokerValue(
                payload,
                Partition(Topic("test"), partition),
                offset,
                datetime.now(),
            )
        )

    def test_message_processing(self) -> None:
        """Test basic message processing."""
        partition = 0
        message = self.create_message("sub1", partition, 100)

        self.expected_items = 1
        self.process_complete_event.clear()

        self.strategy.submit(message)

        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"
        assert len(self.processed_results) == 1
        assert self.processed_results[0]["subscription_id"] == "sub1"

    def test_offset_committing(self) -> None:
        """Test that offsets are committed after processing."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 5
        self.process_complete_event.clear()
        self.commit_event.clear()
        for i in range(5):
            message = self.create_message("sub1", 0, 100 + i)
            self.strategy.submit(message)

        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"
        assert self.commit_event.wait(timeout=2.0), "Commit did not happen in time"

        assert partition in self.committed_offsets
        assert self.committed_offsets[partition] == 104

    def test_preserves_order_within_group(self) -> None:
        """Test that messages for the same subscription are processed in order."""
        self.expected_items = 5
        self.process_complete_event.clear()

        for i in range(5):
            message = self.create_message("sub1", 0, 100 + i)
            self.strategy.submit(message)

        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"
        assert len(self.processed_results) == 5

    def test_concurrent_processing_different_groups(self) -> None:
        """Test that different subscriptions are processed concurrently."""
        self.expected_items = 4
        self.process_complete_event.clear()

        for i in range(4):
            message = self.create_message(f"sub{i % 2}", 0, 100 + i)
            self.strategy.submit(message)

        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"

        assert len(self.processed_results) == 4

    def test_handles_invalid_messages(self) -> None:
        """Test that invalid messages don't block offset commits."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 1
        self.process_complete_event.clear()
        self.commit_event.clear()

        invalid_message = Message(
            BrokerValue(
                FilteredPayload(),
                partition,
                100,
                datetime.now(),
            )
        )

        self.strategy.submit(invalid_message)
        self.strategy.submit(self.create_message("sub1", 0, 101))

        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"
        assert self.commit_event.wait(timeout=2.0), "Commit did not happen in time"
        assert self.committed_offsets.get(partition) == 101

    def test_offset_gaps_block_commits(self) -> None:
        """Test that gaps in offsets prevent committing past the gap."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 3  # First batch
        self.process_complete_event.clear()
        self.commit_event.clear()

        self.strategy.submit(self.create_message("sub1", 0, 100))
        self.strategy.submit(self.create_message("sub1", 0, 102))
        self.strategy.submit(self.create_message("sub1", 0, 103))

        assert self.process_complete_event.wait(timeout=2.0), "Processing did not complete in time"
        assert self.commit_event.wait(timeout=2.0), "Commit did not happen in time"
        assert self.committed_offsets.get(partition) == 100

        self.expected_items = 4
        self.commit_event.clear()
        self.strategy.submit(self.create_message("sub1", 0, 101))

        assert self.commit_event.wait(timeout=2.0), "Second commit did not happen in time"
        assert self.committed_offsets.get(partition) == 103


class TestThreadQueueParallelIntegration(TestCase):
    """Integration test with the ResultsStrategyFactory."""

    def test_factory_creates_thread_queue_parallel_strategy(self) -> None:
        """Test that the factory properly creates thread-queue-parallel strategy."""
        from sentry.remote_subscriptions.consumers.result_consumer import (
            ResultProcessor,
            ResultsStrategyFactory,
        )

        class MockResultProcessor(ResultProcessor):
            @property
            def subscription_model(self):
                return mock.Mock()

            def get_subscription_id(self, result):
                return result.get("subscription_id", "unknown")

            def handle_result(self, subscription, result):
                pass

        class MockFactory(ResultsStrategyFactory):
            @property
            def topic_for_codec(self):
                return SentryTopic.SHARED_RESOURCES_USAGE

            @property
            def result_processor_cls(self):
                return MockResultProcessor

            def build_payload_grouping_key(self, result):
                return result.get("subscription_id", "unknown")

            @property
            def identifier(self):
                return "test"

        factory = MockFactory(mode="thread-queue-parallel", max_workers=5, consumer_group="test")
        commit = mock.Mock()
        partition = Partition(Topic("test"), 0)
        strategy = factory.create_with_partitions(commit, {partition: 0})

        assert isinstance(strategy, SimpleQueueProcessingStrategy)
        assert factory.queue_pool is not None
        assert factory.queue_pool.num_queues == 5

        factory.shutdown()


class TestRebalancing(TestCase):
    """Test rebalancing scenarios for thread-queue-parallel consumer."""

    def setUp(self):
        self.processed_results: list[tuple[str, dict]] = []
        self.process_lock = threading.Lock()
        self.process_condition = threading.Condition(self.process_lock)
        self.commit_calls: list[dict[Partition, int]] = []
        self.commit_lock = threading.Lock()
        self.commit_condition = threading.Condition(self.commit_lock)

        test_case = self

        class MockResultProcessor(ResultProcessor):
            @property
            def subscription_model(self):
                return mock.Mock()

            def get_subscription_id(self, result):
                return result.get("subscription_id", "unknown")

            def handle_result(self, subscription, result):
                pass

            def __call__(self, identifier: str, result: dict):
                with test_case.process_lock:
                    test_case.processed_results.append((identifier, result))

        self.mock_processor_cls = MockResultProcessor

    def _wait_for_processed_count(self, expected_count: int, timeout: float = 2.0) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            with self.process_lock:
                if len(self.processed_results) >= expected_count:
                    return True
            threading.Event().wait(0.01)
        return False

    def _wait_for_commits(self, timeout: float = 1.0) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            with self.commit_lock:
                if len(self.commit_calls) > 0:
                    return True
            threading.Event().wait(0.01)
        return False

    def create_factory(self):
        mock_processor_cls = self.mock_processor_cls

        class TestFactory(ResultsStrategyFactory):
            @property
            def topic_for_codec(self):
                return SentryTopic.SHARED_RESOURCES_USAGE

            @property
            def result_processor_cls(self):
                return mock_processor_cls

            def build_payload_grouping_key(self, result):
                return result.get("subscription_id", "unknown")

            @property
            def identifier(self):
                return "test-rebalance"

            def decode_payload(self, topic_for_codec, payload):
                return json.loads(payload.value)

        return TestFactory(
            mode="thread-queue-parallel", max_workers=3, commit_interval=0.01, consumer_group="test"
        )

    def create_commit_function(self):
        def commit(offsets: dict[Partition, int]):
            with self.commit_lock:
                self.commit_calls.append(offsets.copy())

        return commit

    def create_message(self, subscription_id: str, partition: int, offset: int) -> Message:
        payload = KafkaPayload(
            key=None,
            value=f'{{"subscription_id": "{subscription_id}", "data": "test"}}'.encode(),
            headers=[],
        )
        return Message(
            BrokerValue(
                payload,
                Partition(Topic("test"), partition),
                offset,
                datetime.now(),
            )
        )

    def test_initial_assignment(self) -> None:
        """Test initial partition assignment."""
        factory = self.create_factory()
        commit = self.create_commit_function()

        partitions = {
            Partition(Topic("test"), 0): 100,
            Partition(Topic("test"), 1): 200,
        }

        strategy = factory.create_with_partitions(commit, partitions)
        assert isinstance(strategy, SimpleQueueProcessingStrategy)

        strategy.submit(self.create_message("sub1", 0, 100))
        strategy.submit(self.create_message("sub2", 1, 200))

        assert self._wait_for_processed_count(2, timeout=2.0)

        strategy.close()
        strategy.join(timeout=1.0)
        factory.shutdown()

    def test_partition_revocation_and_reassignment(self) -> None:
        """Test revoking partitions and reassigning new ones."""
        factory = self.create_factory()
        commit = self.create_commit_function()

        initial_partitions = {
            Partition(Topic("test"), 0): 100,
            Partition(Topic("test"), 1): 200,
        }

        strategy = factory.create_with_partitions(commit, initial_partitions)

        strategy.submit(self.create_message("sub1", 0, 100))
        strategy.submit(self.create_message("sub2", 1, 200))

        assert self._wait_for_processed_count(2, timeout=2.0)
        initial_processed = len(self.processed_results)

        strategy.close()
        strategy.join(timeout=1.0)

        new_partitions = {
            Partition(Topic("test"), 1): 201,
            Partition(Topic("test"), 2): 300,
        }

        new_strategy = factory.create_with_partitions(commit, new_partitions)

        new_strategy.submit(self.create_message("sub3", 1, 201))
        new_strategy.submit(self.create_message("sub4", 2, 300))

        new_strategy.submit(self.create_message("sub5", 0, 101))

        assert self._wait_for_processed_count(initial_processed + 2, timeout=2.0)

        new_strategy.close()
        new_strategy.join(timeout=1.0)
        factory.shutdown()

    def test_multiple_rebalances(self) -> None:
        """Test multiple rebalances in succession."""
        factory = self.create_factory()

        partitions_1 = {Partition(Topic("test"), 0): 100}
        strategy_1 = factory.create_with_partitions(self.create_commit_function(), partitions_1)
        strategy_1.submit(self.create_message("sub1", 0, 100))
        assert self._wait_for_processed_count(1, timeout=1.0)
        strategy_1.close()
        strategy_1.join(timeout=1.0)

        partitions_2 = {Partition(Topic("test"), 1): 200}
        strategy_2 = factory.create_with_partitions(self.create_commit_function(), partitions_2)
        strategy_2.submit(self.create_message("sub2", 1, 200))
        assert self._wait_for_processed_count(2, timeout=1.0)
        strategy_2.close()
        strategy_2.join(timeout=1.0)

        partitions_3 = {
            Partition(Topic("test"), 0): 101,
            Partition(Topic("test"), 1): 201,
            Partition(Topic("test"), 2): 300,
        }
        strategy_3 = factory.create_with_partitions(self.create_commit_function(), partitions_3)
        strategy_3.submit(self.create_message("sub3", 0, 101))
        strategy_3.submit(self.create_message("sub4", 1, 201))
        strategy_3.submit(self.create_message("sub5", 2, 300))
        assert self._wait_for_processed_count(5, timeout=1.0)
        strategy_3.close()
        strategy_3.join(timeout=1.0)

        factory.shutdown()

    def test_rebalance_with_pending_messages(self) -> None:
        """Test rebalancing while messages are still being processed."""
        factory = self.create_factory()
        commit = self.create_commit_function()

        partitions = {Partition(Topic("test"), 0): 100}
        strategy = factory.create_with_partitions(commit, partitions)

        for i in range(10):
            strategy.submit(self.create_message(f"sub{i}", 0, 100 + i))

        assert self._wait_for_processed_count(1, timeout=1.0)

        strategy.close()
        strategy.join(timeout=2.0)

        initial_count = len(self.processed_results)
        assert initial_count > 0

        new_partitions = {Partition(Topic("test"), 1): 200}
        new_strategy = factory.create_with_partitions(commit, new_partitions)

        new_strategy.submit(self.create_message("new_sub", 1, 200))
        assert self._wait_for_processed_count(initial_count + 1, timeout=1.0)

        new_strategy.close()
        new_strategy.join(timeout=1.0)
        factory.shutdown()

    def test_commit_behavior_during_rebalance(self) -> None:
        """Test that commits work correctly during rebalances."""
        factory = self.create_factory()

        commit_1 = self.create_commit_function()
        partitions_1 = {
            Partition(Topic("test"), 0): 100,
            Partition(Topic("test"), 1): 200,
        }

        strategy_1 = factory.create_with_partitions(commit_1, partitions_1)

        for i in range(3):
            strategy_1.submit(self.create_message("sub1", 0, 100 + i))
            strategy_1.submit(self.create_message("sub2", 1, 200 + i))

        assert self._wait_for_commits(timeout=1.0)

        assert len(self.commit_calls) > 0
        committed_partitions: set[Partition] = set()
        for commit_call in self.commit_calls:
            committed_partitions.update(commit_call.keys())
        assert Partition(Topic("test"), 0) in committed_partitions
        assert Partition(Topic("test"), 1) in committed_partitions

        self.commit_calls.clear()

        strategy_1.close()
        strategy_1.join(timeout=1.0)

        commit_2 = self.create_commit_function()
        partitions_2 = {Partition(Topic("test"), 1): 203}

        strategy_2 = factory.create_with_partitions(commit_2, partitions_2)

        for i in range(3):
            strategy_2.submit(self.create_message("sub3", 1, 203 + i))

        assert self._wait_for_commits(timeout=1.0)

        assert len(self.commit_calls) > 0
        for commit_call in self.commit_calls:
            assert Partition(Topic("test"), 0) not in commit_call
            assert Partition(Topic("test"), 1) in commit_call

        strategy_2.close()
        strategy_2.join(timeout=1.0)
        factory.shutdown()

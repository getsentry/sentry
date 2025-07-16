"""
Tests for the thread-queue-parallel result consumer implementation.
"""

import threading
from datetime import datetime
from typing import Any
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, FilteredPayload, Message, Partition, Topic

from sentry.remote_subscriptions.consumers.queue_consumer import (
    FixedQueuePool,
    OffsetTracker,
    SimpleQueueProcessingStrategy,
    WorkItem,
)
from sentry.testutils.cases import TestCase


class TestOffsetTracker(TestCase):
    def setUp(self):
        self.tracker = OffsetTracker()
        self.partition1 = Partition(Topic("test"), 0)
        self.partition2 = Partition(Topic("test"), 1)

    def test_simple_tracking(self):
        """Test basic offset tracking and committing."""
        self.tracker.add_offset(self.partition1, 100)
        self.tracker.add_offset(self.partition1, 101)
        self.tracker.add_offset(self.partition1, 102)

        committable = self.tracker.get_committable_offsets()
        assert committable == {}

        self.tracker.complete_offset(self.partition1, 100)
        committable = self.tracker.get_committable_offsets()
        assert committable == {self.partition1: 100}

        self.tracker.mark_committed(self.partition1, 100)
        self.tracker.complete_offset(self.partition1, 102)
        committable = self.tracker.get_committable_offsets()
        assert committable == {}

        self.tracker.complete_offset(self.partition1, 101)
        committable = self.tracker.get_committable_offsets()
        assert committable == {self.partition1: 102}

    def test_multiple_partitions(self):
        """Test tracking across multiple partitions."""
        self.tracker.add_offset(self.partition1, 100)
        self.tracker.add_offset(self.partition1, 101)
        self.tracker.add_offset(self.partition2, 200)
        self.tracker.add_offset(self.partition2, 201)

        self.tracker.complete_offset(self.partition1, 100)
        self.tracker.complete_offset(self.partition2, 200)
        self.tracker.complete_offset(self.partition2, 201)

        committable = self.tracker.get_committable_offsets()
        assert committable == {self.partition1: 100, self.partition2: 201}


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
        )

    def tearDown(self):
        self.pool.shutdown()

    def test_consistent_group_assignment(self):
        """Test that groups are consistently assigned to the same queue."""
        group_key = "group1"
        queue_index1 = self.pool.get_queue_for_group(group_key)
        queue_index2 = self.pool.get_queue_for_group(group_key)
        queue_index3 = self.pool.get_queue_for_group(group_key)

        assert queue_index1 == queue_index2 == queue_index3

    def test_different_groups_distributed(self):
        """Test that different groups are distributed across queues."""
        queue_indices = set()
        for i in range(20):
            group_key = f"group{i}"
            queue_index = self.pool.get_queue_for_group(group_key)
            queue_indices.add(queue_index)

        assert len(queue_indices) == 3

    def test_ordered_processing_within_group(self):
        """Test that items within a group are processed in order."""
        partition = Partition(Topic("test"), 0)
        group_key = "ordered_group"

        self.expected_items = 5
        self.process_complete_event.clear()

        for i in range(5):
            work_item = WorkItem(
                partition=partition,
                offset=i,
                result=f"item_{i}",
                message=Message(
                    BrokerValue(
                        KafkaPayload(b"key", b"value", []),
                        partition,
                        i,
                        datetime.now(),
                    )
                ),
            )
            self.pool.submit(group_key, work_item)

        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"

        group_items = [item for _, item in self.processed_items if item.startswith("item_")]
        assert group_items == ["item_0", "item_1", "item_2", "item_3", "item_4"]

    def test_concurrent_processing_across_groups(self):
        """Test that different groups are processed concurrently."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 6
        self.process_complete_event.clear()

        for i in range(6):
            group_key = f"group_{i % 3}"
            work_item = WorkItem(
                partition=partition,
                offset=i,
                result=f"item_{group_key}_{i}",
                message=Message(
                    BrokerValue(
                        KafkaPayload(b"key", b"value", []),
                        partition,
                        i,
                        datetime.now(),
                    )
                ),
            )
            self.pool.submit(group_key, work_item)

        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"
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

    def test_stats_reporting(self):
        """Test queue statistics reporting."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 10
        self.process_complete_event.clear()

        for i in range(10):
            group_key = f"group_{i % 4}"
            work_item = WorkItem(
                partition=partition,
                offset=i,
                result=f"item_{i}",
                message=Message(
                    BrokerValue(
                        KafkaPayload(b"key", b"value", []),
                        partition,
                        i,
                        datetime.now(),
                    )
                ),
            )
            self.pool.submit(group_key, work_item)

        stats = self.pool.get_stats()
        assert stats["total_items"] > 0
        assert "queue_depths" in stats
        assert len(stats["queue_depths"]) == 3
        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"

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

        self.strategy = SimpleQueueProcessingStrategy(
            queue_pool=self.queue_pool,
            decoder=decoder,
            grouping_fn=grouping_fn,
            commit_function=commit_function,
        )

    def tearDown(self):
        self.strategy.close()

    def create_message(self, subscription_id: str, partition: int, offset: int) -> Message:
        """Helper to create a test message."""
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

    def test_message_processing(self):
        """Test basic message processing."""
        partition = 0
        message = self.create_message("sub1", partition, 100)

        self.expected_items = 1
        self.process_complete_event.clear()

        self.strategy.submit(message)

        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"
        assert len(self.processed_results) == 1
        assert self.processed_results[0]["subscription_id"] == "sub1"

    def test_offset_committing(self):
        """Test that offsets are committed after processing."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 5
        self.process_complete_event.clear()
        self.commit_event.clear()
        for i in range(5):
            message = self.create_message("sub1", 0, 100 + i)
            self.strategy.submit(message)

        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"
        assert self.commit_event.wait(timeout=2.0), "Commit did not happen in time"

        assert partition in self.committed_offsets
        assert self.committed_offsets[partition] == 104

    def test_preserves_order_within_group(self):
        """Test that messages for the same subscription are processed in order."""
        self.expected_items = 5
        self.process_complete_event.clear()

        for i in range(5):
            message = self.create_message("sub1", 0, 100 + i)
            self.strategy.submit(message)

        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"
        assert len(self.processed_results) == 5

    def test_concurrent_processing_different_groups(self):
        """Test that different subscriptions are processed concurrently."""
        self.expected_items = 4
        self.process_complete_event.clear()

        for i in range(4):
            message = self.create_message(f"sub{i % 2}", 0, 100 + i)
            self.strategy.submit(message)

        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"

        assert len(self.processed_results) == 4

    def test_handles_invalid_messages(self):
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

        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"
        assert self.commit_event.wait(timeout=2.0), "Commit did not happen in time"
        assert self.committed_offsets.get(partition) == 101

    def test_offset_gaps_block_commits(self):
        """Test that gaps in offsets prevent committing past the gap."""
        partition = Partition(Topic("test"), 0)

        self.expected_items = 3  # First batch
        self.process_complete_event.clear()
        self.commit_event.clear()

        self.strategy.submit(self.create_message("sub1", 0, 100))
        self.strategy.submit(self.create_message("sub1", 0, 102))
        self.strategy.submit(self.create_message("sub1", 0, 103))

        assert self.process_complete_event.wait(timeout=5.0), "Processing did not complete in time"
        assert self.commit_event.wait(timeout=2.0), "Commit did not happen in time"
        assert self.committed_offsets.get(partition) == 100

        self.expected_items = 4
        self.commit_event.clear()
        self.strategy.submit(self.create_message("sub1", 0, 101))

        assert self.commit_event.wait(timeout=2.0), "Second commit did not happen in time"
        assert self.committed_offsets.get(partition) == 103


class TestThreadQueueParallelIntegration(TestCase):
    """Integration test with the ResultsStrategyFactory."""

    def test_factory_creates_thread_queue_parallel_strategy(self):
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
                return Topic("test")

            @property
            def result_processor_cls(self):
                return MockResultProcessor

            def build_payload_grouping_key(self, result):
                return result.get("subscription_id", "unknown")

            @property
            def identifier(self):
                return "test"

        factory = MockFactory(mode="thread-queue-parallel", max_workers=5)
        commit = mock.Mock()
        partition = Partition(Topic("test"), 0)
        strategy = factory.create_with_partitions(commit, {partition: 0})

        assert isinstance(strategy, SimpleQueueProcessingStrategy)
        assert factory.queue_pool is not None
        assert factory.queue_pool.num_queues == 5

        factory.shutdown()

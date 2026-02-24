import hashlib

import pytest

from sentry.notifications.models.notificationrecord import NotificationRecord
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.threading import ThreadingService
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.testutils.cases import TestCase
from sentry.utils import json


class ThreadingServiceTestBase(TestCase):
    def setUp(self) -> None:
        self.key_type = NotificationSource.ERROR_ALERT
        self.key_data = {"rule_fire_history_id": 123, "rule_action_uuid": "abc-123"}
        self.provider_key = NotificationProviderKey.SLACK
        self.target_id = "C1234567890"
        self.message_id = "1234567890.123456"
        self.thread_identifier = "1234567890.123456"
        self.thread_key = ThreadingService.compute_thread_key(self.key_type, self.key_data)


class ThreadingServiceComputeThreadKeyTest(TestCase):
    def test_compute_thread_key_is_deterministic(self) -> None:
        key_type = NotificationSource.ERROR_ALERT
        key_data = {"rule_fire_history_id": 123, "rule_action_uuid": "abc-123"}

        result1 = ThreadingService.compute_thread_key(key_type, key_data)
        result2 = ThreadingService.compute_thread_key(key_type, key_data)

        assert result1 == result2

    def test_compute_thread_key_order_independent(self) -> None:
        key_type = NotificationSource.ERROR_ALERT
        key_data_1 = {"rule_fire_history_id": 123, "rule_action_uuid": "abc-123"}
        key_data_2 = {"rule_action_uuid": "abc-123", "rule_fire_history_id": 123}

        result1 = ThreadingService.compute_thread_key(key_type, key_data_1)
        result2 = ThreadingService.compute_thread_key(key_type, key_data_2)

        assert result1 == result2

    def test_compute_thread_key_different_types_produce_different_hashes(self) -> None:
        key_data = {"id": 123}

        result1 = ThreadingService.compute_thread_key(NotificationSource.ERROR_ALERT, key_data)
        result2 = ThreadingService.compute_thread_key(
            NotificationSource.SLOW_LOAD_METRIC_ALERT, key_data
        )

        assert result1 != result2

    def test_compute_thread_key_different_data_produce_different_hashes(self) -> None:
        key_type = NotificationSource.ERROR_ALERT

        result1 = ThreadingService.compute_thread_key(key_type, {"id": 123})
        result2 = ThreadingService.compute_thread_key(key_type, {"id": 456})

        assert result1 != result2

    def test_compute_thread_key_matches_expected_format(self) -> None:
        key_type = NotificationSource.ERROR_ALERT
        key_data = {"a": 1, "b": 2}

        result = ThreadingService.compute_thread_key(key_type, key_data)

        normalized_data = json.dumps(key_data, sort_keys=True)
        expected_input = f"{key_type}:{normalized_data}"
        expected_hash = hashlib.sha256(expected_input.encode()).hexdigest()
        assert result == expected_hash


class ThreadingServiceResolveTest(ThreadingServiceTestBase):
    def test_resolve_returns_thread_when_exists(self) -> None:
        created_thread = NotificationThread.objects.create(
            thread_key=self.thread_key,
            provider_key=self.provider_key,
            target_id=self.target_id,
            thread_identifier=self.thread_identifier,
            key_type=self.key_type,
            key_data=self.key_data,
        )

        result = ThreadingService.resolve(
            key_type=self.key_type,
            key_data=self.key_data,
            provider_key=self.provider_key,
            target_id=self.target_id,
        )

        assert result is not None
        assert isinstance(result, NotificationThread)
        assert result.id == created_thread.id
        assert result.thread_identifier == self.thread_identifier

    def test_resolve_returns_none_when_not_exists(self) -> None:
        result = ThreadingService.resolve(
            key_type=self.key_type,
            key_data={"rule_fire_history_id": 999},
            provider_key=self.provider_key,
            target_id=self.target_id,
        )

        assert result is None

    def test_resolve_returns_none_for_different_target_id(self) -> None:
        NotificationThread.objects.create(
            thread_key=self.thread_key,
            provider_key=self.provider_key,
            target_id="C1111111111",
            thread_identifier=self.thread_identifier,
            key_type=self.key_type,
            key_data=self.key_data,
        )

        result = ThreadingService.resolve(
            key_type=self.key_type,
            key_data=self.key_data,
            provider_key=self.provider_key,
            target_id="C2222222222",
        )

        assert result is None

    def test_resolve_returns_none_for_different_provider(self) -> None:
        NotificationThread.objects.create(
            thread_key=self.thread_key,
            provider_key=NotificationProviderKey.SLACK,
            target_id=self.target_id,
            thread_identifier=self.thread_identifier,
            key_type=self.key_type,
            key_data=self.key_data,
        )

        result = ThreadingService.resolve(
            key_type=self.key_type,
            key_data=self.key_data,
            provider_key=NotificationProviderKey.DISCORD,
            target_id=self.target_id,
        )

        assert result is None


class ThreadingServiceStoreTest(ThreadingServiceTestBase):
    def test_store_creates_thread_and_record_when_no_thread(self) -> None:
        thread, record = ThreadingService.store(
            key_type=self.key_type,
            key_data=self.key_data,
            provider_key=self.provider_key,
            target_id=self.target_id,
            message_id=self.message_id,
            thread_identifier=self.thread_identifier,
        )

        # Returns NotificationThread
        assert isinstance(thread, NotificationThread)
        assert thread.thread_identifier == self.thread_identifier
        assert thread.id is not None
        assert thread.thread_key == self.thread_key
        assert thread.provider_key == self.provider_key
        assert thread.target_id == self.target_id
        assert thread.key_type == self.key_type
        assert thread.key_data == self.key_data
        assert thread.provider_data == {}

        # Returns NotificationRecord
        assert record.id is not None
        assert record.thread_id == thread.id
        assert record.provider_key == self.provider_key
        assert record.target_id == self.target_id
        assert record.message_id == self.message_id

    def test_store_links_to_existing_thread_when_thread_provided(self) -> None:
        # First message creates the thread
        first_message_id = "1234567890.111111"
        first_thread, first_record = ThreadingService.store(
            key_type=self.key_type,
            key_data=self.key_data,
            provider_key=self.provider_key,
            target_id=self.target_id,
            message_id=first_message_id,
            thread_identifier=first_message_id,
        )

        # Second message uses thread from first
        second_message_id = "1234567890.222222"
        second_thread, second_record = ThreadingService.store(
            key_type=self.key_type,
            key_data=self.key_data,
            provider_key=self.provider_key,
            target_id=self.target_id,
            message_id=second_message_id,
            thread_identifier=first_message_id,
            thread=first_thread,
        )

        # Same thread
        assert first_thread.id == second_thread.id
        assert second_thread.thread_identifier == first_message_id

        # Different records
        assert first_record.id != second_record.id
        assert first_record.message_id == first_message_id
        assert second_record.message_id == second_message_id

        # Only one thread in DB
        assert NotificationThread.objects.count() == 1
        # Two records in DB
        assert NotificationRecord.objects.count() == 2

    def test_store_raises_error_when_thread_mismatches_provider_key(self) -> None:
        # Create a thread with Slack
        thread, _ = ThreadingService.store(
            key_type=self.key_type,
            key_data=self.key_data,
            provider_key=self.provider_key,
            target_id=self.target_id,
            message_id=self.message_id,
            thread_identifier=self.thread_identifier,
        )

        # Try to use that thread with Discord - should fail
        with pytest.raises(ValueError, match="does not match parameters"):
            ThreadingService.store(
                key_type=self.key_type,
                key_data=self.key_data,
                provider_key=NotificationProviderKey.DISCORD,
                target_id=self.target_id,
                message_id="discord-msg-123",
                thread_identifier="discord-thread-123",
                thread=thread,
            )

    def test_store_raises_error_when_thread_mismatches_target_id(self) -> None:
        # Create a thread for channel A
        thread, _ = ThreadingService.store(
            key_type=self.key_type,
            key_data=self.key_data,
            provider_key=self.provider_key,
            target_id="C1111111111",
            message_id=self.message_id,
            thread_identifier=self.thread_identifier,
        )

        # Try to use that thread for channel B - should fail
        with pytest.raises(ValueError, match="does not match parameters"):
            ThreadingService.store(
                key_type=self.key_type,
                key_data=self.key_data,
                provider_key=self.provider_key,
                target_id="C2222222222",
                message_id="1234567890.222222",
                thread_identifier="1234567890.222222",
                thread=thread,
            )

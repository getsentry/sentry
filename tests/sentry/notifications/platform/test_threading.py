import hashlib

from sentry.notifications.models.notificationrecord import NotificationRecord
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.threading import (
    ThreadingConfig,
    ThreadingLookup,
    ThreadingService,
)
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

        self.threading_lookup: ThreadingLookup = {
            "key_type": self.key_type,
            "key_data": self.key_data,
            "provider_key": self.provider_key,
            "target_id": self.target_id,
        }

        self.threading_config: ThreadingConfig = {
            "key_type": self.key_type,
            "key_data": self.key_data,
            "provider_key": self.provider_key,
            "target_id": self.target_id,
            "thread_identifier": self.thread_identifier,
            "provider_data": None,
        }


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

        result = ThreadingService.resolve(threading_lookup=self.threading_lookup)

        assert result is not None
        assert isinstance(result, NotificationThread)
        assert result.id == created_thread.id
        assert result.thread_identifier == self.thread_identifier

    def test_resolve_returns_none_when_not_exists(self) -> None:
        result = ThreadingService.resolve(
            threading_lookup={
                "key_type": self.key_type,
                "key_data": {"rule_fire_history_id": 999},
                "provider_key": self.provider_key,
                "target_id": self.target_id,
            }
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
            threading_lookup={
                "key_type": self.key_type,
                "key_data": self.key_data,
                "provider_key": self.provider_key,
                "target_id": "C2222222222",
            }
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
            threading_lookup={
                "key_type": self.key_type,
                "key_data": self.key_data,
                "provider_key": NotificationProviderKey.DISCORD,
                "target_id": self.target_id,
            }
        )

        assert result is None


class ThreadingServiceStoreNewThreadTest(ThreadingServiceTestBase):
    def test_store_new_thread_creates_thread_and_record(self) -> None:
        thread, record = ThreadingService.store_new_thread(
            threading_config=self.threading_config,
            external_message_id=self.message_id,
        )

        assert isinstance(thread, NotificationThread)
        assert thread.thread_identifier == self.thread_identifier
        assert thread.id is not None
        assert thread.thread_key == self.thread_key
        assert thread.provider_key == self.provider_key
        assert thread.target_id == self.target_id
        assert thread.key_type == self.key_type
        assert thread.key_data == self.key_data
        assert thread.provider_data == {}

        assert record.id is not None
        assert record.thread_id == thread.id
        assert record.provider_key == self.provider_key
        assert record.target_id == self.target_id
        assert record.message_id == self.message_id

    def test_store_new_thread_uses_existing_thread_on_race(self) -> None:
        """If two workers race, the second get_or_create returns the first's thread."""
        first_thread, _ = ThreadingService.store_new_thread(
            threading_config=self.threading_config,
            external_message_id="1234567890.111111",
        )

        # Second call with a different thread_identifier (simulating race)
        second_config: ThreadingConfig = {
            **self.threading_config,
            "thread_identifier": "1234567890.222222",
        }
        second_thread, second_record = ThreadingService.store_new_thread(
            threading_config=second_config,
            external_message_id="1234567890.222222",
        )

        # get_or_create returns the first thread
        assert first_thread.id == second_thread.id
        assert second_thread.thread_identifier == self.thread_identifier

        assert NotificationThread.objects.count() == 1
        assert NotificationRecord.objects.count() == 2


class ThreadingServiceStoreExistingThreadTest(ThreadingServiceTestBase):
    def test_store_existing_thread_links_record_to_thread(self) -> None:
        # Create a thread first
        first_thread, first_record = ThreadingService.store_new_thread(
            threading_config=self.threading_config,
            external_message_id="1234567890.111111",
        )

        # Store a second message under the existing thread
        second_message_id = "1234567890.222222"
        second_thread, second_record = ThreadingService.store_existing_thread(
            thread=first_thread,
            external_message_id=second_message_id,
        )

        # Same thread
        assert first_thread.id == second_thread.id
        assert second_thread.thread_identifier == self.thread_identifier

        # Different records
        assert first_record.id != second_record.id
        assert first_record.message_id == "1234567890.111111"
        assert second_record.message_id == second_message_id

        assert NotificationThread.objects.count() == 1
        assert NotificationRecord.objects.count() == 2

from __future__ import annotations

import hashlib
import logging
from typing import Any, TypedDict

from django.db import router, transaction

from sentry.notifications.models.notificationrecord import NotificationRecord
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.utils import json

logger = logging.getLogger(__name__)


# Info needed to lookup a thread
class ThreadingLookup(TypedDict):
    # The notification source type
    key_type: NotificationSource

    # Dictionary of identifying data for this thread
    # e.g for issue alerts {"rule_fire_history_id": 123, "rule_action_uuid": "abc-123"}
    key_data: dict[str, Any]

    # The notification provider
    provider_key: NotificationProviderKey

    # The target identifier (e.g., channel_id)
    target_id: str


# Info needed to create a new thread
class ThreadingConfig(ThreadingLookup):
    # The provider-specific thread identifier
    thread_identifier: str

    # Optional provider-specific metadata
    provider_data: dict[str, Any] | None


class ThreadingService:
    """
    Service for managing notification threading.
    """

    @staticmethod
    def compute_thread_key(key_type: NotificationSource, key_data: dict[str, Any]) -> str:
        """
        Compute a unique thread key from the key type and key data.

        The thread key is a SHA-256 hash of the key_type + sorted JSON key_data,
        which allows for efficient lookups without needing to query by multiple fields.

        Args:
            key_type: The notification source type (e.g., "issue_alert", "metric_alert")
            key_data: Dictionary of identifying data for this thread

        Returns:
            A 64-character hex string (SHA-256 hash)
        """
        normalized_data = json.dumps(key_data, sort_keys=True)
        hash_input = f"{key_type}:{normalized_data}"
        return hashlib.sha256(hash_input.encode()).hexdigest()

    @staticmethod
    def resolve(
        *,
        threading_lookup: ThreadingLookup,
    ) -> NotificationThread | None:
        """
        Check if a thread exists for the given key and return it.

        Call this before sending a notification to determine if the message
        should be threaded. If a thread is returned, use its thread_identifier
        when sending to the provider.

        Args:
            threading_lookup: The information needed to lookup a thread (see ThreadingLookup)

        Returns:
            NotificationThread if a thread exists, None otherwise
        """
        thread_key = ThreadingService.compute_thread_key(
            threading_lookup["key_type"], threading_lookup["key_data"]
        )

        try:
            return NotificationThread.objects.get(
                thread_key=thread_key,
                provider_key=threading_lookup["provider_key"],
                target_id=threading_lookup["target_id"],
            )
        except NotificationThread.DoesNotExist:
            return None

    @staticmethod
    def _create_thread_and_record(
        threading_config: ThreadingConfig,
        external_message_id: str,
        thread_key: str,
    ) -> tuple[NotificationThread, NotificationRecord]:
        with transaction.atomic(router.db_for_write(NotificationThread)):
            thread, _created = NotificationThread.objects.get_or_create(
                thread_key=thread_key,
                provider_key=threading_config["provider_key"],
                target_id=threading_config["target_id"],
                defaults={
                    "thread_identifier": threading_config["thread_identifier"],
                    "key_type": threading_config["key_type"],
                    "key_data": threading_config["key_data"],
                    "provider_data": threading_config["provider_data"] or {},
                },
            )

            record = NotificationRecord.objects.create(
                thread=thread,
                provider_key=threading_config["provider_key"],
                target_id=threading_config["target_id"],
                message_id=external_message_id,
            )

            return thread, record

    @staticmethod
    def store_new_thread(
        *,
        threading_config: ThreadingConfig,
        external_message_id: str,
    ) -> tuple[NotificationThread, NotificationRecord]:
        """
        Store a notification message and create a new thread.

        Args:
            threading_config: The information needed to create a new thread (see ThreadingConfig)
            external_message_id: The provider-specific message identifier returned by the provider

        Returns:
            A tuple of (NotificationThread, NotificationRecord)
        """
        thread_key = ThreadingService.compute_thread_key(
            threading_config["key_type"], threading_config["key_data"]
        )
        return ThreadingService._create_thread_and_record(
            threading_config, external_message_id, thread_key
        )

    @staticmethod
    def store_existing_thread(
        *,
        thread: NotificationThread,
        external_message_id: str,
    ) -> tuple[NotificationThread, NotificationRecord]:
        """
        Store a notification message for an existing thread.

        Args:
            thread: The existing thread to store the message in
            external_message_id: The provider-specific message identifier returned by the provider

        Returns:
            A tuple of (NotificationThread, NotificationRecord)
        """
        with transaction.atomic(router.db_for_write(NotificationRecord)):
            record = NotificationRecord.objects.create(
                thread=thread,
                provider_key=thread.provider_key,
                target_id=thread.target_id,
                message_id=external_message_id,
            )

            return thread, record

from __future__ import annotations

import hashlib
import logging
from typing import Any

from django.db import router, transaction

from sentry.notifications.models.notificationrecord import NotificationRecord
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.utils import json

logger = logging.getLogger(__name__)


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
        key_type: NotificationSource,
        key_data: dict[str, Any],
        provider_key: NotificationProviderKey,
        target_id: str,
    ) -> NotificationThread | None:
        """
        Check if a thread exists for the given key and return it.

        Call this before sending a notification to determine if the message
        should be threaded. If a thread is returned, use its thread_identifier
        when sending to the provider.

        Args:
            key_type: The notification source type
            key_data: Dictionary of identifying data for this thread e.g for issue alerts {"rule_fire_history_id": 123, "rule_action_uuid": "abc-123"}
            provider_key: The notification provider (e.g., "slack", "msteams")
            target_id: The target identifier (e.g., channel_id)

        Returns:
            NotificationThread if a thread exists, None otherwise
        """
        thread_key = ThreadingService.compute_thread_key(key_type, key_data)

        try:
            return NotificationThread.objects.get(
                thread_key=thread_key,
                provider_key=provider_key,
                target_id=target_id,
            )
        except NotificationThread.DoesNotExist:
            return None

    @staticmethod
    def store(
        *,
        key_type: NotificationSource,
        key_data: dict[str, Any],
        provider_key: NotificationProviderKey,
        target_id: str,
        message_id: str,
        thread_identifier: str,
        thread: NotificationThread | None = None,
        provider_data: dict[str, Any] | None = None,
    ) -> tuple[NotificationThread, NotificationRecord]:
        """
        Store a notification message and its thread.

        If thread is None (first message), creates a new NotificationThread
        using the provided thread_identifier, plus a NotificationRecord.

        If thread is provided (subsequent messages), links the new
        NotificationRecord to the existing thread.

        Args:
            key_type: The notification source type
            key_data: Dictionary of identifying data for this thread
            provider_key: The notification provider
            target_id: The target identifier (e.g., channel_id)
            message_id: The provider-specific message identifier returned by the provider
            thread: The thread from resolve() if an existing thread was found
            thread_identifier: The provider-specific thread identifier
            provider_data: Optional provider-specific metadata (only used when creating thread)

        Returns:
            A tuple of (NotificationThread, NotificationRecord)

        Raises:
            ValueError: If thread is provided but doesn't match provider_key or target_id
        """
        if thread is not None:
            if thread.provider_key != provider_key or thread.target_id != target_id:
                raise ValueError(
                    f"Provided thread (provider_key={thread.provider_key}, target_id={thread.target_id}) does not match parameters (provider_key={provider_key}, target_id={target_id})"
                )

        with transaction.atomic(router.db_for_write(NotificationThread)):
            if thread is None:
                thread_key = ThreadingService.compute_thread_key(key_type, key_data)
                thread, created = NotificationThread.objects.get_or_create(
                    thread_key=thread_key,
                    provider_key=provider_key,
                    target_id=target_id,
                    defaults={
                        "thread_identifier": thread_identifier,
                        "key_type": key_type,
                        "key_data": key_data,
                        "provider_data": provider_data or {},
                    },
                )

            # Create the record for this message
            record = NotificationRecord.objects.create(
                thread=thread,
                provider_key=provider_key,
                target_id=target_id,
                message_id=message_id,
            )

            return thread, record

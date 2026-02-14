from __future__ import annotations

import contextlib
import functools
from typing import Any

from django.conf import settings
from django.core.handlers.wsgi import WSGIRequest

from sentry.hybridcloud.models.outbox import OutboxBase
from sentry.hybridcloud.models.webhookpayload import THE_PAST, DestinationType, WebhookPayload
from sentry.hybridcloud.tasks.deliver_from_outbox import (
    enqueue_outbox_jobs,
    enqueue_outbox_jobs_control,
)
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode


class OutboxRecursionLimitError(Exception):
    pass


@contextlib.contextmanager
def outbox_runner(wrapped: Any | None = None) -> Any:
    """
    A context manager that, upon *successful exit*, executes all pending outbox jobs that are scheduled for
    the current time, synchronously.  Exceptions block further processing as written -- to test retry cases,
    use the inner implementation functions directly.
    """
    if callable(wrapped):

        def wrapper(*args: Any, **kwargs: Any) -> Any:
            assert callable(wrapped)
            with outbox_runner():
                return wrapped(*args, **kwargs)

        functools.update_wrapper(wrapper, wrapped)
        return wrapper

    yield
    from sentry.testutils.helpers.task_runner import TaskRunner

    with TaskRunner(), assume_test_silo_mode(SiloMode.MONOLITH):
        for i in range(10):
            enqueue_outbox_jobs(concurrency=1, process_outbox_backfills=False)
            enqueue_outbox_jobs_control(concurrency=1, process_outbox_backfills=False)

            if not any(
                OutboxBase.from_outbox_name(outbox_name).find_scheduled_shards()
                for outbox_names in settings.SENTRY_OUTBOX_MODELS.values()
                for outbox_name in outbox_names
            ):
                break
        else:
            raise OutboxRecursionLimitError


def assert_no_webhook_payloads() -> None:
    messages = WebhookPayload.objects.filter().count()
    assert messages == 0, "No webhookpayload messages should be created"


def assert_webhook_payloads_for_mailbox(
    request: WSGIRequest,
    mailbox_name: str,
    region_names: list[str],
    destination_types: dict[DestinationType, int] | None = None,
) -> None:
    """
    A test method for asserting that a webhook payload is properly queued for
     the given request

    :param request:
    :param mailbox_name: The mailbox name that messages should be found in.
    :param region_names: Optional list of regions each messages should be queued for
    :param destination_types: Optional Mapping of destination types to the number of messages that should be found for that destination type
    """
    expected_payload = WebhookPayload.get_attributes_from_request(request=request)
    region_names_set = set(region_names)
    messages = WebhookPayload.objects.filter(mailbox_name=mailbox_name)
    messages_with_region_count = messages.filter(region_name__isnull=False).count()
    if messages_with_region_count != len(region_names_set):
        raise Exception(
            f"Mismatch: Found {messages_with_region_count} WebhookPayload but {len(region_names_set)} region_names"
        )
    for message in messages:
        assert message.request_method == expected_payload["request_method"]
        assert message.request_path == expected_payload["request_path"]
        assert message.request_headers == expected_payload["request_headers"]
        assert message.request_body == expected_payload["request_body"]
        assert message.schedule_for == THE_PAST
        assert message.attempts == 0

        if destination_types:
            destination_type = DestinationType(message.destination_type)
            assert destination_type in destination_types
            destination_types[destination_type] -= 1
            if destination_types[destination_type] == 0:
                del destination_types[destination_type]

        if message.destination_type == DestinationType.CODECOV:
            assert message.region_name is None
        else:
            assert message.region_name is not None
            try:
                region_names_set.remove(message.region_name)
            except KeyError:
                raise Exception(
                    f"Found ControlOutbox for '{message.region_name}', which was not in region_names: {str(region_names_set)}"
                )
    if len(region_names_set) != 0:
        raise Exception(f"WebhookPayload not found for some region_names: {str(region_names_set)}")

    if destination_types and len(destination_types) != 0:
        exc_strs = [
            f"Missing {count} WebhookPayloads for {destination_type}"
            for destination_type, count in destination_types.items()
        ]
        raise Exception(
            f"Not enough WebhookPayloads found for some destination_types:\n{'\n'.join(exc_strs)}"
        )

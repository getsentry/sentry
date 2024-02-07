from __future__ import annotations

import contextlib
import dataclasses
import functools
from typing import Any

from django.conf import settings
from django.core.handlers.wsgi import WSGIRequest

from sentry.models.outbox import ControlOutbox, OutboxBase, OutboxCategory, OutboxScope
from sentry.silo import SiloMode
from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs, enqueue_outbox_jobs_control
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


def assert_no_webhook_outboxes():
    outboxes = ControlOutbox.objects.filter(category=OutboxCategory.WEBHOOK_PROXY).count()
    assert outboxes == 0, "No outboxes should be created"


def assert_webhook_outboxes_with_shard_id(
    factory_request: WSGIRequest,
    expected_shard_id: int,
    region_names: list[str],
):
    """
    A test method for asserting that a webhook outbox is properly queued for
     the given request

    :param factory_request:
    :param expected_shard_id: Usually the integration ID associated with the
     request. The main exception is Plugins, which provides a different shard
     ID in the form of an organization ID instead.
    :param region_names: The regions each outbox should be queued for
    """
    expected_payload = ControlOutbox.get_webhook_payload_from_request(request=factory_request)
    expected_payload_dict = dataclasses.asdict(expected_payload)
    region_names_set = set(region_names)
    outboxes = ControlOutbox.objects.filter(category=OutboxCategory.WEBHOOK_PROXY)
    cob_count = outboxes.count()
    if cob_count != len(region_names_set):
        raise Exception(
            f"Mismatch: Found {cob_count} ControlOutboxes but {len(region_names_set)} region_names"
        )
    for cob in outboxes:
        assert cob.payload == expected_payload_dict
        assert cob.shard_scope == OutboxScope.WEBHOOK_SCOPE
        assert cob.shard_identifier == expected_shard_id
        assert cob.category == OutboxCategory.WEBHOOK_PROXY
        try:
            region_names_set.remove(cob.region_name)
        except KeyError:
            raise Exception(
                f"Found ControlOutbox for '{cob.region_name}', which was not in region_names: {str(region_names_set)}"
            )
    if len(region_names_set) != 0:
        raise Exception(f"ControlOutbox not found for some region_names: {str(region_names_set)}")

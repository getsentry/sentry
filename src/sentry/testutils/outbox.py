from __future__ import annotations

import contextlib
import dataclasses
import functools
from typing import Any, List

from django.core.handlers.wsgi import WSGIRequest

from sentry.models.outbox import (
    ControlOutbox,
    OutboxCategory,
    OutboxScope,
    WebhookProviderIdentifier,
)
from sentry.silo import SiloMode
from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs
from sentry.testutils.silo import assume_test_silo_mode


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
        while enqueue_outbox_jobs():
            pass


def assert_webhook_outboxes(
    factory_request: WSGIRequest,
    webhook_identifier: WebhookProviderIdentifier,
    region_names: List[str],
):
    expected_payload = ControlOutbox.get_webhook_payload_from_request(request=factory_request)  # type: ignore
    expected_payload_dict = dataclasses.asdict(expected_payload)
    assert ControlOutbox.objects.count() == len(region_names)
    region_names_set = set(region_names)
    for cob in ControlOutbox.objects.all():
        assert cob.payload == expected_payload_dict
        assert cob.shard_scope == OutboxScope.WEBHOOK_SCOPE
        assert cob.shard_identifier == webhook_identifier
        assert cob.category == OutboxCategory.WEBHOOK_PROXY
        try:
            region_names_set.remove(cob.region_name)
        except KeyError:
            raise Exception(
                f"Found outbox for '{cob.region_name}', which was not in region_names: {str(region_names_set)}"
            )

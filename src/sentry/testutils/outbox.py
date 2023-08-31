from __future__ import annotations

import contextlib
import dataclasses
import functools
from typing import Any, List

from django.conf import settings
from django.core.handlers.wsgi import WSGIRequest
from sentry_sdk.api import capture_exception

from sentry.models.outbox import (
    THE_PAST,
    ControlOutbox,
    ControlOutboxBase,
    OutboxCategory,
    OutboxScope,
    RegionOutboxBase,
    WebhookProviderIdentifier,
)
from sentry.silo import SiloMode
from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs, enqueue_outbox_jobs_control
from sentry.testutils.silo import assume_test_silo_mode


@contextlib.contextmanager
def outbox_runner(wrapped: Any | None = None, rerun_until_converged=False) -> Any:
    """
    A context manager that, upon *successful exit*, executes all pending outbox jobs that are scheduled for
    the current time, synchronously.  When rerun_until_converged is True, outboxes scheduled in the future are also
    run, exceptions are swallowed, and up to 100 iteration attempts are made to successfully process all pending
    outboxes in this manner.  This is useful in the case that you are testing known temporary failure cases, such
    as unordered outbox processing with implicit dependencies.
    """
    if callable(wrapped):

        def wrapper(*args: Any, **kwargs: Any) -> Any:
            assert callable(wrapped)
            with outbox_runner(rerun_until_converged=rerun_until_converged):
                return wrapped(*args, **kwargs)

        functools.update_wrapper(wrapper, wrapped)
        return wrapper

    yield
    from sentry.testutils.helpers.task_runner import TaskRunner

    def execute_iteration():
        with TaskRunner(), assume_test_silo_mode(SiloMode.MONOLITH):
            while enqueue_outbox_jobs():
                pass
            while enqueue_outbox_jobs_control():
                pass

    if rerun_until_converged:
        for _ in range(100):
            has_work = False
            with assume_test_silo_mode(SiloMode.MONOLITH):
                for outbox_name in settings.SENTRY_OUTBOX_MODELS["CONTROL"]:
                    has_work = (
                        has_work
                        or ControlOutboxBase.from_outbox_name(outbox_name).objects.update(
                            scheduled_for=THE_PAST
                        )
                        > 0
                    )

                for outbox_name in settings.SENTRY_OUTBOX_MODELS["REGION"]:
                    has_work = (
                        has_work
                        or RegionOutboxBase.from_outbox_name(outbox_name).objects.update(
                            scheduled_for=THE_PAST
                        )
                        > 0
                    )
            if not has_work:
                break

            try:
                execute_iteration()
            except Exception:
                capture_exception()
        else:
            raise AssertionError("outbox_runner did not converge after 100 iterations!")
    else:
        execute_iteration()


def assert_webhook_outboxes(
    factory_request: WSGIRequest,
    webhook_identifier: WebhookProviderIdentifier,
    region_names: List[str],
):
    expected_payload = ControlOutbox.get_webhook_payload_from_request(request=factory_request)
    expected_payload_dict = dataclasses.asdict(expected_payload)
    region_names_set = set(region_names)
    cob_count = ControlOutbox.objects.count()
    if cob_count != len(region_names_set):
        raise Exception(
            f"Mismatch: Found {cob_count} ControlOutboxes but {len(region_names_set)} region_names"
        )
    for cob in ControlOutbox.objects.all():
        assert cob.payload == expected_payload_dict
        assert cob.shard_scope == OutboxScope.WEBHOOK_SCOPE
        assert cob.shard_identifier == webhook_identifier
        assert cob.category == OutboxCategory.WEBHOOK_PROXY
        try:
            region_names_set.remove(cob.region_name)
        except KeyError:
            raise Exception(
                f"Found ControlOutbox for '{cob.region_name}', which was not in region_names: {str(region_names_set)}"
            )
    if len(region_names_set) != 0:
        raise Exception(f"ControlOutbox not found for some region_names: {str(region_names_set)}")

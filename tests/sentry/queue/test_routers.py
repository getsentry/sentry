import itertools
from collections.abc import Mapping, Sequence

import pytest
from django.test import override_settings

from sentry import options
from sentry.queue.routers import SplitQueueRouter, SplitQueueTaskRouter
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_split_router_legacy() -> None:
    queues = [
        "post_process_transactions_1",
        "post_process_transactions_2",
        "post_process_transactions_3",
    ]
    queues_gen = itertools.cycle(queues)
    with override_settings(
        SENTRY_POST_PROCESS_QUEUE_SPLIT_ROUTER={
            "post_process_transactions": lambda: next(queues_gen),
        },
        CELERY_SPLIT_QUEUE_ROUTES={},
    ):
        router = SplitQueueRouter()
        assert router.route_for_queue("save_event") == "save_event"
        assert router.route_for_queue("post_process_transactions") == "post_process_transactions_1"
        assert router.route_for_queue("post_process_transactions") == "post_process_transactions_2"
        assert router.route_for_queue("post_process_transactions") == "post_process_transactions_3"

        legacy_mode = options.get("celery_split_queue_legacy_mode")
        options.set("celery_split_queue_legacy_mode", [])
        try:
            # Disabled legacy mode. As the split queue config is not there
            # split queue does not happen/
            router = SplitQueueRouter()
            assert (
                router.route_for_queue("post_process_transactions") == "post_process_transactions"
            )
        finally:
            options.set("celery_split_queue_legacy_mode", legacy_mode)


@django_db_all
def test_router_not_rolled_out() -> None:
    with override_settings(
        SENTRY_POST_PROCESS_QUEUE_SPLIT_ROUTER={},
    ):
        rollout = options.get("celery_split_queue_rollout")
        options.set(
            "celery_split_queue_rollout",
            {
                "post_process_transactions": 0.0,
            },
        )

        try:
            router = SplitQueueRouter()
            assert (
                router.route_for_queue("post_process_transactions") == "post_process_transactions"
            )
        finally:
            options.set("celery_split_queue_rollout", rollout)


@django_db_all
def test_router_rolled_out() -> None:
    with override_settings(
        SENTRY_POST_PROCESS_QUEUE_SPLIT_ROUTER={},
    ):
        rollout = options.get("celery_split_queue_legacy_mode")
        options.set("celery_split_queue_legacy_mode", [])
        try:
            router = SplitQueueRouter()
            assert (
                router.route_for_queue("post_process_transactions") == "post_process_transactions_1"
            )
            assert (
                router.route_for_queue("post_process_transactions") == "post_process_transactions_2"
            )
            assert (
                router.route_for_queue("post_process_transactions") == "post_process_transactions_3"
            )
        finally:
            options.set("celery_split_queue_legacy_mode", rollout)


@pytest.mark.parametrize(
    "rollout_option, task_test, expected",
    [
        pytest.param(
            {"sentry.tasks.store.save_event": 1.0},
            "sentry.tasks.store.save_event_transaction",
            [
                {"queue": "events.save_event_transaction"},
                {"queue": "events.save_event_transaction"},
            ],
            id="Config present, not rolled out",
        ),
        pytest.param(
            {"sentry.tasks.store.save_event": 1.0},
            "sentry.tasks.store.save_event",
            [None, None],
            id="No config, rollout option on",
        ),
        pytest.param(
            {"sentry.tasks.store.save_event": 1.0},
            "sentry.tasks.store.save_something_else",
            [None, None],
            id="No config, No rollout",
        ),
        pytest.param(
            {"sentry.tasks.store.save_event_transaction": 1.0},
            "sentry.tasks.store.save_event_transaction",
            [
                {"queue": "events.save_event_transaction_1"},
                {"queue": "events.save_event_transaction_2"},
            ],
            id="Config present rolled out",
        ),
    ],
)
@django_db_all
def test_task_rollout(
    rollout_option: Mapping[str, float],
    task_test: str,
    expected: Sequence[Mapping[str, str] | None],
) -> None:

    with override_settings(
        CELERY_SPLIT_QUEUE_TASK_ROUTES={
            "sentry.tasks.store.save_event_transaction": (
                [
                    "events.save_event_transaction_1",
                    "events.save_event_transaction_2",
                    "events.save_event_transaction_3",
                ],
                "events.save_event_transaction",
            )
        },
    ):
        current_rollout = options.get("celery_split_queue_task_rollout")
        options.set("celery_split_queue_task_rollout", rollout_option)
        try:
            router = SplitQueueTaskRouter()
            assert router.route_for_task(task_test) == expected[0]
            assert router.route_for_task(task_test) == expected[1]
        finally:
            options.set("celery_split_queue_task_rollout", current_rollout)

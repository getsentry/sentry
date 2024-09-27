from collections.abc import Mapping, Sequence

import pytest
from django.conf import settings
from django.test import override_settings

from sentry import options
from sentry.conf.types.celery import SplitQueueTaskRoute
from sentry.queue.routers import SplitQueueTaskRouter
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.celery import make_split_task_queues

CELERY_SPLIT_QUEUE_TASK_ROUTES: Mapping[str, SplitQueueTaskRoute] = {
    "sentry.tasks.store.save_event_transaction": {
        "default_queue": "events.save_event_transaction",
        "queues_config": {
            "total": 5,
            "in_use": 2,
        },
    }
}


@pytest.mark.parametrize(
    "rollout_option, task_test, expected",
    [
        pytest.param(
            {"sentry.tasks.store.save_event": 1.0},
            "sentry.tasks.store.save_event_transaction",
            [
                {"queue": "events.save_event_transaction"},
                {"queue": "events.save_event_transaction"},
                {"queue": "events.save_event_transaction"},
            ],
            id="Config present, not rolled out",
        ),
        pytest.param(
            {"sentry.tasks.store.save_event": 1.0},
            "sentry.tasks.store.save_event",
            [None, None, None],
            id="No config, rollout option on",
        ),
        pytest.param(
            {"sentry.tasks.store.save_event": 1.0},
            "sentry.tasks.store.save_something_else",
            [None, None, None],
            id="No config, No rollout",
        ),
        pytest.param(
            {"sentry.tasks.store.save_event_transaction": 1.0},
            "sentry.tasks.store.save_event_transaction",
            [
                {"queue": "events.save_event_transaction_1"},
                {"queue": "events.save_event_transaction_2"},
                {"queue": "events.save_event_transaction_1"},
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
        CELERY_SPLIT_QUEUE_TASK_ROUTES=CELERY_SPLIT_QUEUE_TASK_ROUTES,
        CELERY_QUEUES=[
            *settings.CELERY_QUEUES,
            *make_split_task_queues(CELERY_SPLIT_QUEUE_TASK_ROUTES),
        ],
    ):
        current_rollout = options.get("celery_split_queue_task_rollout")
        options.set("celery_split_queue_task_rollout", rollout_option)
        try:
            router = SplitQueueTaskRouter()
            assert router.route_for_task(task_test) == expected[0]
            assert router.route_for_task(task_test) == expected[1]
            assert router.route_for_task(task_test) == expected[2]
        finally:
            options.set("celery_split_queue_task_rollout", current_rollout)


CELERY_NO_SPLIT_QUEUE_TASK_ROUTES: Mapping[str, SplitQueueTaskRoute] = {
    "sentry.tasks.store.save_event_transaction": {
        "default_queue": "events.save_event_transaction",
    }
}


@django_db_all
def test_task_no_split() -> None:
    with override_settings(
        CELERY_SPLIT_QUEUE_TASK_ROUTES=CELERY_NO_SPLIT_QUEUE_TASK_ROUTES,
        CELERY_QUEUES=[
            *settings.CELERY_QUEUES,
            *make_split_task_queues(CELERY_SPLIT_QUEUE_TASK_ROUTES),
        ],
    ):
        current_rollout = options.get("celery_split_queue_task_rollout")
        options.set(
            "celery_split_queue_task_rollout",
            {"sentry.tasks.store.save_event_transaction": 1.0},
        )
        try:
            router = SplitQueueTaskRouter()
            assert router.route_for_task("sentry.tasks.store.save_event_transaction") == {
                "queue": "events.save_event_transaction"
            }
            assert router.route_for_task("sentry.tasks.store.save_event_transaction") == {
                "queue": "events.save_event_transaction"
            }
        finally:
            options.set("celery_split_queue_task_rollout", current_rollout)

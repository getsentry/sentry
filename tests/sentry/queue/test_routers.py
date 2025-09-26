from collections.abc import Mapping, Sequence

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.conf.types.celery import SplitQueueSize, SplitQueueTaskRoute
from sentry.queue.routers import SplitQueueRouter, SplitQueueTaskRouter
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.celery import make_split_queues, make_split_task_queues

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
@override_settings(
    CELERY_SPLIT_QUEUE_TASK_ROUTES=CELERY_SPLIT_QUEUE_TASK_ROUTES,
    CELERY_QUEUES=[
        *settings.CELERY_QUEUES,
        *make_split_task_queues(CELERY_SPLIT_QUEUE_TASK_ROUTES),
    ],
)
def test_task_rollout(
    rollout_option: Mapping[str, float],
    task_test: str,
    expected: Sequence[Mapping[str, str] | None],
) -> None:

    with override_options({"celery_split_queue_task_rollout": rollout_option}):
        router = SplitQueueTaskRouter()
        assert router.route_for_task(task_test) == expected[0]
        assert router.route_for_task(task_test) == expected[1]
        assert router.route_for_task(task_test) == expected[2]


CELERY_NO_SPLIT_QUEUE_TASK_ROUTES: Mapping[str, SplitQueueTaskRoute] = {
    "sentry.tasks.store.save_event_transaction": {
        "default_queue": "events.save_event_transaction",
    }
}


@django_db_all
@override_settings(
    CELERY_SPLIT_QUEUE_TASK_ROUTES=CELERY_NO_SPLIT_QUEUE_TASK_ROUTES,
    CELERY_QUEUES=[
        *settings.CELERY_QUEUES,
        *make_split_task_queues(CELERY_SPLIT_QUEUE_TASK_ROUTES),
    ],
)
@override_options(
    {
        "celery_split_queue_task_rollout": {"sentry.tasks.store.save_event_transaction": 1.0},
    }
)
def test_task_no_split() -> None:
    router = SplitQueueTaskRouter()
    assert router.route_for_task("sentry.tasks.store.save_event_transaction") == {
        "queue": "events.save_event_transaction"
    }
    assert router.route_for_task("sentry.tasks.store.save_event_transaction") == {
        "queue": "events.save_event_transaction"
    }


CELERY_SPLIT_QUEUE_ROUTES: Mapping[str, SplitQueueSize] = {
    "post_process_transactions": {"total": 5, "in_use": 3},
    "post_process_errors": {"total": 5, "in_use": 1},
}


@django_db_all
@override_settings(
    SENTRY_POST_PROCESS_QUEUE_SPLIT_ROUTER={},
    CELERY_SPLIT_QUEUE_ROUTES=CELERY_SPLIT_QUEUE_ROUTES,
    CELERY_QUEUES=[
        *settings.CELERY_QUEUES,
        *make_split_queues(CELERY_SPLIT_QUEUE_ROUTES),
    ],
)
@override_options(
    {
        "celery_split_queue_rollout": {
            "post_process_transactions": 0.0,
        },
    }
)
def test_router_not_rolled_out() -> None:
    router = SplitQueueRouter()
    assert router.route_for_queue("post_process_transactions") == "post_process_transactions"


@django_db_all
@override_settings(
    SENTRY_POST_PROCESS_QUEUE_SPLIT_ROUTER={},
    CELERY_SPLIT_QUEUE_ROUTES=CELERY_SPLIT_QUEUE_ROUTES,
    CELERY_QUEUES=[
        *settings.CELERY_QUEUES,
        *make_split_queues(CELERY_SPLIT_QUEUE_ROUTES),
    ],
)
@override_options(
    {
        "celery_split_queue_legacy_mode": [],
        "celery_split_queue_rollout": {
            "post_process_transactions": 1.0,
            "post_process_errors": 1.0,
        },
    }
)
def test_router_rolled_out() -> None:
    router = SplitQueueRouter()
    assert router.route_for_queue("post_process_transactions") == "post_process_transactions_1"
    assert router.route_for_queue("post_process_transactions") == "post_process_transactions_2"
    assert router.route_for_queue("post_process_transactions") == "post_process_transactions_3"
    assert router.route_for_queue("post_process_transactions") == "post_process_transactions_1"
    # Here the queue is disabled because the config contained in_use = 1
    assert router.route_for_queue("post_process_errors") == "post_process_errors"
    assert router.route_for_queue("post_process_issue_platform") == "post_process_issue_platform"

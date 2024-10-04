import itertools
from collections.abc import Mapping

from django.conf import settings
from django.test import override_settings

from sentry.conf.types.celery import SplitQueueSize
from sentry.queue.routers import SplitQueueRouter
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.celery import make_split_queues


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

        with override_options({"celery_split_queue_legacy_mode": []}):
            # Disabled legacy mode. As the split queue config is not there
            # split queue does not happen/
            router = SplitQueueRouter()
            assert (
                router.route_for_queue("post_process_transactions") == "post_process_transactions"
            )


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

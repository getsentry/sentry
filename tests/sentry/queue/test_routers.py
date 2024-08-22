import itertools

from django.test import override_settings

from sentry import options
from sentry.queue.routers import SplitQueueRouter
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
        assert router.route_to_split_queue("save_event") == "save_event"
        assert (
            router.route_to_split_queue("post_process_transactions")
            == "post_process_transactions_1"
        )
        assert (
            router.route_to_split_queue("post_process_transactions")
            == "post_process_transactions_2"
        )
        assert (
            router.route_to_split_queue("post_process_transactions")
            == "post_process_transactions_3"
        )

        legacy_mode = options.get("celery_split_queue_legacy_mode")
        options.set("celery_split_queue_legacy_mode", [])
        try:
            # Disabled legacy mode. As the split queue config is not there
            # split queue does not happen/
            router = SplitQueueRouter()
            assert (
                router.route_to_split_queue("post_process_transactions")
                == "post_process_transactions"
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
                router.route_to_split_queue("post_process_transactions")
                == "post_process_transactions"
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
                router.route_to_split_queue("post_process_transactions")
                == "post_process_transactions_1"
            )
            assert (
                router.route_to_split_queue("post_process_transactions")
                == "post_process_transactions_2"
            )
            assert (
                router.route_to_split_queue("post_process_transactions")
                == "post_process_transactions_3"
            )
        finally:
            options.set("celery_split_queue_legacy_mode", rollout)

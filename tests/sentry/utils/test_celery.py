from kombu import Queue

from sentry.utils.celery import (
    build_queue_names,
    make_split_queues,
    make_split_task_queues,
    safe_append,
    safe_extend,
)


def test_split_task_queue() -> None:
    assert make_split_task_queues(
        {
            "my_task": {
                "default_queue": "my_queue",
            },
            "my_other_task": {
                "default_queue": "my_other_queue",
                "queues_config": {"total": 3, "in_use": 1},
            },
        }
    ) == [
        Queue(name="my_other_queue_1", routing_key="my_other_queue_1"),
        Queue(name="my_other_queue_2", routing_key="my_other_queue_2"),
        Queue(name="my_other_queue_3", routing_key="my_other_queue_3"),
    ]


def test_split_queue() -> None:
    assert make_split_queues(
        {
            "my_queue": {"total": 3, "in_use": 1},
            "my_other_queue": {"total": 1, "in_use": 1},
        }
    ) == [
        Queue(name="my_queue_1", routing_key="my_queue_1"),
        Queue(name="my_queue_2", routing_key="my_queue_2"),
        Queue(name="my_queue_3", routing_key="my_queue_3"),
        Queue(name="my_other_queue_1", routing_key="my_other_queue_1"),
    ]


def test_build_names() -> None:
    assert build_queue_names("my_queue", 3) == ["my_queue_1", "my_queue_2", "my_queue_3"]


def test_safe_append() -> None:
    queues = [
        Queue(name="my_queue_1", routing_key="my_queue_1"),
        Queue(name="my_queue_2", routing_key="my_queue_2"),
    ]

    safe_append(queues, Queue(name="my_queue_1", routing_key="my_queue_1"))
    safe_append(queues, Queue(name="my_queue_3", routing_key="my_queue_3"))

    assert queues == [
        Queue(name="my_queue_1", routing_key="my_queue_1"),
        Queue(name="my_queue_2", routing_key="my_queue_2"),
        Queue(name="my_queue_3", routing_key="my_queue_3"),
    ]


def test_safe_extend() -> None:
    queues = [
        Queue(name="my_queue_1", routing_key="my_queue_1"),
    ]

    safe_extend(
        queues,
        [
            Queue(name="my_queue_1", routing_key="my_queue_1"),
            Queue(name="my_queue_2", routing_key="my_queue_2"),
        ],
    )

    assert queues == [
        Queue(name="my_queue_1", routing_key="my_queue_1"),
        Queue(name="my_queue_2", routing_key="my_queue_2"),
    ]

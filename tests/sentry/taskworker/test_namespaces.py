from taskbroker_client.registry import TaskRegistry

from sentry.owners import Owner
from sentry.taskworker.adapters import SentryRouter, make_metrics, make_producer
from sentry.taskworker.namespaces import alerts_tasks, namespace_owner


def test_namespace_owner() -> None:
    assert namespace_owner(alerts_tasks) == Owner.ALERTS_MONITORS


def test_namespace_owner_of_foreign_namespace_is_unowned() -> None:
    registry = TaskRegistry(
        application="getsentry",
        producer_factory=make_producer,
        router=SentryRouter(),
        metrics=make_metrics(),
    )
    namespace = registry.create_namespace("billing")

    assert namespace_owner(namespace) == Owner.UNOWNED

import logging

import sentry_sdk
from django.db import router

from sentry import features
from sentry.explore.translation.alerts_translation import _get_old_query_info
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.subscriptions import bulk_update_snuba_subscriptions
from sentry.utils.db import atomic_transaction
from sentry.workflow_engine.models.data_source import DataSource

logger = logging.getLogger(__name__)


def snapshot_snuba_query(snuba_query: SnubaQuery):
    if not snuba_query.query_snapshot and snuba_query.dataset in [
        Dataset.PerformanceMetrics.value,
    ]:
        query_snapshot = {
            "metrics_to_transactions": True,
        }
        snuba_query.query_snapshot = query_snapshot
        snuba_query.save()

    return snuba_query


def translate_am1_metrics_detector_and_update_subscription_in_snuba(snuba_query: SnubaQuery):
    query_subscription_qs = QuerySubscription.objects.filter(
        snuba_query_id=snuba_query.id,
        status__in=[QuerySubscription.Status.ACTIVE.value, QuerySubscription.Status.UPDATING.value],
    )
    query_subscription = query_subscription_qs.first()

    if not query_subscription:
        logger.info("No active query subscription found for snuba query %s", snuba_query.id)
        return

    try:
        data_source: DataSource = DataSource.objects.get(
            source_id=str(query_subscription.id), type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
        )
    except DataSource.DoesNotExist as e:
        logger.info("Data source not found for snuba query %s", snuba_query.id)
        sentry_sdk.capture_exception(e)
        return
    if not features.has(
        "organizations:migrate-am1-metrics-alerts-to-transactions", data_source.organization
    ):
        logger.info("Feature flag not enabled")
        return

    snapshot_snuba_query(snuba_query)

    snapshot = snuba_query.query_snapshot
    if not snapshot and snuba_query.dataset == Dataset.PerformanceMetrics.value:
        logger.info("No snapshot created for snuba query %s", snuba_query.id)
        return

    if snapshot and snapshot.get("user_updated"):
        logger.info(
            "Skipping migration for user-updated query", extra={"snuba_query_id": snuba_query.id}
        )
        return

    old_query_type, old_dataset, old_query, old_aggregate = _get_old_query_info(snuba_query)

    snuba_query.dataset = Dataset.Transactions.value

    with atomic_transaction(
        using=(
            router.db_for_write(SnubaQuery),
            router.db_for_write(SnubaQueryEventType),
            router.db_for_write(QuerySubscription),
        )
    ):
        snuba_query.save()

        query_subscriptions = list(snuba_query.subscriptions.all())
        try:
            bulk_update_snuba_subscriptions(
                query_subscriptions, old_query_type, old_dataset, old_aggregate, old_query
            )
        except Exception as e:
            logger.info(
                "Query not migrated: error updating subscriptions in snuba",
                extra={"snuba_query_id": snuba_query.id, "error": e},
            )
            raise

        logger.info(
            "Query successfully migrated to transactions", extra={"snuba_query_id": snuba_query.id}
        )
    return


def rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query: SnubaQuery):
    # querying for updating as well just in case the subscription gets stuck in updating
    query_subscription_qs = QuerySubscription.objects.filter(
        snuba_query_id=snuba_query.id,
        status__in=[QuerySubscription.Status.ACTIVE.value, QuerySubscription.Status.UPDATING.value],
    )
    query_subscription = query_subscription_qs.first()

    if not query_subscription:
        logger.info("No active query subscription found for snuba query %s", snuba_query.id)
        return

    try:
        data_source: DataSource = DataSource.objects.get(
            source_id=str(query_subscription.id), type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
        )
    except DataSource.DoesNotExist as e:
        logger.info("Data source not found for snuba query %s", snuba_query.id)
        sentry_sdk.capture_exception(e)
        return

    if not features.has(
        "organizations:migrate-am1-metrics-alerts-to-transactions", data_source.organization
    ):
        logger.info("Feature flag not enabled")
        return

    snapshot = snuba_query.query_snapshot
    is_snapshot_am1_metrics = (
        snapshot is not None and snapshot.get("metrics_to_transactions", False) is True
    )

    if not is_snapshot_am1_metrics:
        logger.info("No snapshot found for snuba query %s", snuba_query.id)
        return

    if snapshot and snapshot.get("user_updated"):
        logger.info(
            "Skipping rollback for user-updated query", extra={"snuba_query_id": snuba_query.id}
        )
        return

    if snuba_query.dataset == Dataset.PerformanceMetrics.value:
        logger.info("Query already migrated to metrics", extra={"snuba_query_id": snuba_query.id})
        return

    if snuba_query.dataset != Dataset.Transactions.value:
        logger.info(
            "Query is not the correct dataset to rollback", extra={"snuba_query_id": snuba_query.id}
        )
        return

    old_query_type, old_dataset, old_query, old_aggregate = _get_old_query_info(snuba_query)

    with atomic_transaction(
        using=(
            router.db_for_write(SnubaQuery),
            router.db_for_write(SnubaQueryEventType),
            router.db_for_write(QuerySubscription),
        )
    ):
        snuba_query.update(
            dataset=Dataset.PerformanceMetrics.value,
        )

        query_subscriptions = list(snuba_query.subscriptions.all())
        try:
            bulk_update_snuba_subscriptions(
                query_subscriptions, old_query_type, old_dataset, old_aggregate, old_query
            )
        except Exception as e:
            logger.info(
                "Query not rolled back: error updating subscriptions in snuba",
                extra={"snuba_query_id": snuba_query.id, "error": e},
            )
            raise

        logger.info(
            "Query successfully rolled back to legacy", extra={"snuba_query_id": snuba_query.id}
        )
    return

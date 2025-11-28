import logging

import sentry_sdk
from django.db import router, transaction

from sentry import features
from sentry.discover.translation.mep_to_eap import QueryParts, translate_mep_to_eap
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.subscription_processor import MetricIssueDetectorConfig
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.seer.anomaly_detection.store_data import SeerMethod
from sentry.seer.anomaly_detection.store_data_workflow_engine import (
    handle_send_historical_data_to_seer,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    ExtrapolationMode,
    QuerySubscription,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.tasks import update_subscription_in_snuba
from sentry.utils.db import atomic_transaction
from sentry.workflow_engine.models.data_condition import DataCondition
from sentry.workflow_engine.models.data_source import DataSource

logger = logging.getLogger(__name__)


def snapshot_snuba_query(snuba_query: SnubaQuery):
    if snuba_query.dataset in [Dataset.PerformanceMetrics.value, Dataset.Transactions.value]:
        query_snapshot = {
            "type": snuba_query.type,
            "dataset": snuba_query.dataset,
            "query": snuba_query.query,
            "aggregate": snuba_query.aggregate,
            "time_window": snuba_query.time_window,
        }
        snuba_query.query_snapshot = query_snapshot
        snuba_query.save()

    return snuba_query


def _get_old_query_info(snuba_query: SnubaQuery):
    old_query_type = SnubaQuery.Type(snuba_query.type)
    old_dataset = Dataset(snuba_query.dataset)
    old_query = snuba_query.query
    old_aggregate = snuba_query.aggregate

    return old_query_type, old_dataset, old_query, old_aggregate


def translate_detector_and_update_subscription_in_snuba(snuba_query: SnubaQuery):
    data_source: DataSource = DataSource.objects.get(
        source_id=str(snuba_query.id), type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
    )
    if not features.has(
        "organizations:migrate-transaction-alerts-to-spans", data_source.organization
    ):
        logger.info("Feature flag not enabled")
        return

    detectors = data_source.detectors.all()
    snapshot_snuba_query(snuba_query)

    snapshot = snuba_query.query_snapshot
    if not snapshot:
        return

    old_query_type, old_dataset, old_query, old_aggregate = _get_old_query_info(snuba_query)

    eap_query_parts, dropped_fields = translate_mep_to_eap(
        QueryParts(
            selected_columns=[snapshot["aggregate"]],
            query=snapshot["query"],
            equations=None,
            orderby=None,
        )
    )

    if dropped_fields["selected_columns"]:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("dropped_fields", dropped_fields["selected_columns"])
            scope.set_tag("snuba_query", snuba_query.id)
            sentry_sdk.capture_message("Unsported column")
        return

    translated_aggregate = eap_query_parts["selected_columns"][0]
    translated_query = eap_query_parts["query"]

    snuba_query.aggregate = translated_aggregate
    snuba_query.query = translated_query
    snuba_query.dataset = Dataset.EventsAnalyticsPlatform.value

    if snapshot["dataset"] == Dataset.PerformanceMetrics.value:
        snuba_query.extrapolation_mode = ExtrapolationMode.SERVER_WEIGHTED.value
    elif snapshot["dataset"] == Dataset.Transactions.value:
        snuba_query.extrapolation_mode = ExtrapolationMode.NONE.value

    with atomic_transaction(
        using=(
            router.db_for_write(SnubaQuery),
            router.db_for_write(SnubaQueryEventType),
        )
    ):
        snuba_query.save()
        SnubaQueryEventType.objects.filter(snuba_query=snuba_query).delete()
        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value
        )

    query_subscriptions = list(snuba_query.subscriptions.all())
    for subscription in query_subscriptions:
        with transaction.atomic(router.db_for_write(QuerySubscription)):
            subscription.update(status=QuerySubscription.Status.UPDATING.value)

            transaction.on_commit(
                lambda: update_subscription_in_snuba(
                    query_subscription_id=subscription.id,
                    old_query_type=old_query_type.value,
                    old_dataset=old_dataset.value,
                    old_aggregate=old_aggregate,
                    old_query=old_query,
                ),
                using=router.db_for_write(QuerySubscription),
            )

    for detector in detectors:
        detector_cfg: MetricIssueDetectorConfig = detector.config
        if detector_cfg["detection_type"] == AlertRuleDetectionType.DYNAMIC.value:
            data_condition = DataCondition.objects.get(
                condition_group=detector.workflow_condition_group
            )
            handle_send_historical_data_to_seer(
                detector,
                data_source,
                data_condition,
                snuba_query,
                detector.project,
                SeerMethod.UPDATE,
                event_types=[SnubaQueryEventType.EventType.TRACE_ITEM_SPAN],
            )

    return


def rollback_detector_query_and_update_subscription_in_snuba(snuba_query: SnubaQuery):
    data_source: DataSource = DataSource.objects.get(
        source_id=str(snuba_query.id), type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
    )
    if not features.has(
        "organizations:migrate-transaction-alerts-to-spans", data_source.organization
    ):
        logger.info("Feature flag not enabled")
        return

    snapshot = snuba_query.query_snapshot

    if not snapshot:
        return

    detectors = data_source.detectors.all()

    old_query_type, old_dataset, old_query, old_aggregate = _get_old_query_info(snuba_query)
    with atomic_transaction(
        using=(
            router.db_for_write(SnubaQuery),
            router.db_for_write(SnubaQueryEventType),
        )
    ):
        snuba_query.update(
            type=snapshot["type"],
            dataset=snapshot["dataset"],
            query=snapshot["query"],
            aggregate=snapshot["aggregate"],
            time_window=snapshot["time_window"],
        )
        SnubaQueryEventType.objects.filter(snuba_query=snuba_query).delete()
        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRANSACTION.value
        )

    query_subscriptions = list(snuba_query.subscriptions.all())
    for subscription in query_subscriptions:
        with transaction.atomic(router.db_for_write(QuerySubscription)):
            subscription.update(status=QuerySubscription.Status.UPDATING.value)

            transaction.on_commit(
                lambda: update_subscription_in_snuba(
                    query_subscription_id=subscription.id,
                    old_query_type=old_query_type.value,
                    old_dataset=old_dataset.value,
                    old_aggregate=old_aggregate,
                    old_query=old_query,
                ),
                using=router.db_for_write(QuerySubscription),
            )

    for detector in detectors:
        detector_cfg: MetricIssueDetectorConfig = detector.config
        if detector_cfg["detection_type"] == AlertRuleDetectionType.DYNAMIC.value:
            data_condition = DataCondition.objects.get(
                condition_group=detector.workflow_condition_group
            )
            handle_send_historical_data_to_seer(
                detector,
                data_source,
                data_condition,
                snuba_query,
                detector.project,
                SeerMethod.UPDATE,
                event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            )

    return

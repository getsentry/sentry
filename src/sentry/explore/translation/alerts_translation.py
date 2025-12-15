import logging

import sentry_sdk
from django.db import router

from sentry import features
from sentry.discover.arithmetic import is_equation, strip_equation
from sentry.discover.translation.mep_to_eap import QueryParts, translate_mep_to_eap
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.subscription_processor import MetricIssueDetectorConfig
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.search.events.fields import parse_function
from sentry.seer.anomaly_detection.store_data import SeerMethod
from sentry.seer.anomaly_detection.store_data_workflow_engine import (
    handle_send_historical_data_to_seer,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import parse_mri
from sentry.snuba.models import (
    ExtrapolationMode,
    QuerySubscription,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.subscriptions import bulk_update_snuba_subscriptions
from sentry.utils.db import atomic_transaction
from sentry.workflow_engine.models.data_condition import DataCondition
from sentry.workflow_engine.models.data_source import DataSource

logger = logging.getLogger(__name__)

COUNT_BASED_ALERT_AGGREAGTES = [
    "count",
    "failure_count",
    "sum",
    "count_if",
    "count_unique",
]

COUNT_AGGREGATE_PREFIX = "count("


def snapshot_snuba_query(snuba_query: SnubaQuery):
    if not snuba_query.query_snapshot and snuba_query.dataset in [
        Dataset.PerformanceMetrics.value,
        Dataset.Transactions.value,
    ]:
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
        "organizations:migrate-transaction-alerts-to-spans", data_source.organization
    ):
        logger.info("Feature flag not enabled")
        return

    detectors = data_source.detectors.all()
    snapshot_snuba_query(snuba_query)

    snapshot = snuba_query.query_snapshot
    if not snapshot:
        logger.info("No snapshot created for snuba query %s", snuba_query.id)
        return

    if snapshot.get("user_updated"):
        logger.info(
            "Skipping roll forward for user-updated query", extra={"snuba_query_id": snuba_query.id}
        )
        return

    old_query_type, old_dataset, old_query, old_aggregate = _get_old_query_info(snuba_query)

    snapshot_aggregate = snapshot["aggregate"]
    snapshot_query = snapshot["query"]

    # handles count functions with arguments (even custom measurement arguments)
    if snapshot["aggregate"].startswith(COUNT_AGGREGATE_PREFIX):
        aggregate, arguments, _ = parse_function(snapshot_aggregate)
        snapshot_aggregate = "count()"
        if len(arguments) > 0:
            argument = arguments[0]
            # add has:argument condition to simulate count(argument)
            parsed_argument_mri = parse_mri(argument)
            if parsed_argument_mri is not None:
                parsed_argument = parsed_argument_mri.name
            else:
                parsed_argument = argument
            if len(snapshot_query) > 0:
                snapshot_query = f"({snapshot_query}) AND has:{parsed_argument}"
            else:
                snapshot_query = f"has:{parsed_argument}"

    eap_query_parts, dropped_fields = translate_mep_to_eap(
        QueryParts(
            selected_columns=[snapshot_aggregate],
            query=snapshot_query,
            equations=None,
            orderby=None,
        )
    )

    if dropped_fields["selected_columns"]:
        logger.info("Unsupported column dropped for snuba query %s", snuba_query.id)
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("dropped_fields", dropped_fields["selected_columns"])
            scope.set_tag("snuba_query", snuba_query.id)
            sentry_sdk.capture_message("Unsported column")
        return

    translated_aggregate = eap_query_parts["selected_columns"][0]
    # some functions like apdex() are translated to equations, but alerts doesn't need that so we can just strip the equation prefix
    if is_equation(translated_aggregate):
        translated_aggregate = strip_equation(translated_aggregate)
    translated_query = eap_query_parts["query"]

    snuba_query.aggregate = translated_aggregate
    snuba_query.query = translated_query
    snuba_query.dataset = Dataset.EventsAnalyticsPlatform.value

    function_name, _, _ = parse_function(old_aggregate)
    if function_name in COUNT_BASED_ALERT_AGGREAGTES:
        if snapshot["dataset"] == Dataset.PerformanceMetrics.value:
            snuba_query.extrapolation_mode = ExtrapolationMode.SERVER_WEIGHTED.value
        elif snapshot["dataset"] == Dataset.Transactions.value:
            snuba_query.extrapolation_mode = ExtrapolationMode.NONE.value
    else:
        snuba_query.extrapolation_mode = ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value

    with atomic_transaction(
        using=(
            router.db_for_write(SnubaQuery),
            router.db_for_write(SnubaQueryEventType),
            router.db_for_write(QuerySubscription),
            router.db_for_read(DataCondition),
        )
    ):
        snuba_query.save()
        SnubaQueryEventType.objects.filter(snuba_query=snuba_query).delete()
        SnubaQueryEventType.objects.create(
            snuba_query=snuba_query, type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value
        )

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

        try:
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
        except Exception as e:
            logger.info(
                "Query not migrated: error sending historical data to seer",
                extra={"snuba_query_id": snuba_query.id, "error": e},
            )
            raise

        logger.info("Query successfully migrated to EAP", extra={"snuba_query_id": snuba_query.id})
    return


def rollback_detector_query_and_update_subscription_in_snuba(snuba_query: SnubaQuery):
    # querying for updating as well just in case the subscription gets stuck in updating
    query_subscription_qs = QuerySubscription.objects.filter(
        snuba_query_id=snuba_query.id,
        status__in=[QuerySubscription.Status.ACTIVE.value, QuerySubscription.Status.UPDATING.value],
    )
    query_subscription = query_subscription_qs.first()

    if not query_subscription:
        logger.info("No active query subscription found for snuba query %s", snuba_query.id)
        return

    data_source: DataSource = DataSource.objects.get(
        source_id=str(query_subscription.id), type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
    )
    if not features.has(
        "organizations:migrate-transaction-alerts-to-spans", data_source.organization
    ):
        logger.info("Feature flag not enabled")
        return

    snapshot = snuba_query.query_snapshot

    if not snapshot:
        logger.info("No snapshot found for snuba query %s", snuba_query.id)
        return

    # Skip rollback if user has already updated this alert/monitor
    if snapshot.get("user_updated"):
        logger.info(
            "Skipping rollback for user-updated query", extra={"snuba_query_id": snuba_query.id}
        )
        return

    detectors = data_source.detectors.all()

    old_query_type, old_dataset, old_query, old_aggregate = _get_old_query_info(snuba_query)

    with atomic_transaction(
        using=(
            router.db_for_write(SnubaQuery),
            router.db_for_write(SnubaQueryEventType),
            router.db_for_write(QuerySubscription),
            router.db_for_read(DataCondition),
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

        try:
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
        except Exception as e:
            logger.info(
                "Query not rolled back: error sending historical data to seer",
                extra={"snuba_query_id": snuba_query.id, "error": e},
            )
            raise

        logger.info(
            "Query successfully rolled back to legacy", extra={"snuba_query_id": snuba_query.id}
        )
    return

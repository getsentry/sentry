import logging
from collections.abc import Sequence
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers
from snuba_sdk import Column, Condition, Entity, Limit, Op

from sentry import features
from sentry.api.serializers.rest_framework import EnvironmentField
from sentry.exceptions import (
    IncompatibleMetricsQuery,
    InvalidSearchQuery,
    UnsupportedQuerySubscription,
)
from sentry.incidents.logic import (
    check_aggregate_column_support,
    get_column_from_aggregate,
    query_datasets_to_type,
    translate_aggregate_field,
)
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.dataset import Dataset
from sentry.snuba.entity_subscription import (
    ENTITY_TIME_COLUMNS,
    get_entity_key_from_query_builder,
    get_entity_subscription,
)
from sentry.snuba.metrics.naming_layer.mri import is_mri
from sentry.snuba.models import (
    QuerySubscription,
    QuerySubscriptionDataSourceHandler,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.workflow_engine.endpoints.validators.base import BaseDataSourceValidator

logger = logging.getLogger(__name__)

# TODO(davidenwang): eventually we should pass some form of these to the event_search parser to raise an error
UNSUPPORTED_QUERIES = {"release:latest"}

# Allowed time windows (in minutes) for crash rate alerts
CRASH_RATE_ALERTS_ALLOWED_TIME_WINDOWS = [30, 60, 120, 240, 720, 1440]


QUERY_TYPE_VALID_DATASETS = {
    SnubaQuery.Type.ERROR: {Dataset.Events},
    SnubaQuery.Type.PERFORMANCE: {
        Dataset.Transactions,
        Dataset.PerformanceMetrics,
        Dataset.EventsAnalyticsPlatform,
    },
    SnubaQuery.Type.CRASH_RATE: {Dataset.Metrics},
}

QUERY_TYPE_VALID_EVENT_TYPES = {
    SnubaQuery.Type.ERROR: {
        SnubaQueryEventType.EventType.ERROR,
        SnubaQueryEventType.EventType.DEFAULT,
    },
    SnubaQuery.Type.PERFORMANCE: {SnubaQueryEventType.EventType.TRANSACTION},
}


class SnubaQueryValidator(BaseDataSourceValidator[QuerySubscription]):
    query_type = serializers.IntegerField(required=False)
    dataset = serializers.CharField(required=True)
    query = serializers.CharField(required=True)
    aggregate = serializers.CharField(required=True)
    time_window = serializers.IntegerField(required=True)
    environment = EnvironmentField(required=True, allow_null=True)
    event_types = serializers.ListField(
        child=serializers.CharField(),
    )

    class Meta:
        model = QuerySubscription
        fields = [
            "query_type",
            "dataset",
            "query",
            "aggregate",
            "time_window",
            "environment",
            "event_types",
        ]

    data_source_type_handler = QuerySubscriptionDataSourceHandler

    def validate_query_type(self, value: int) -> SnubaQuery.Type:
        try:
            return SnubaQuery.Type(value)
        except ValueError:
            raise serializers.ValidationError(f"Invalid query type {value}")

    def validate_dataset(self, value: str) -> Dataset:
        try:
            dataset_value = Dataset(value)
            if dataset_value in [Dataset.PerformanceMetrics, Dataset.Transactions]:
                return self._validate_performance_dataset(dataset_value)

            return dataset_value
        except ValueError:
            raise serializers.ValidationError(
                "Invalid dataset, valid values are %s" % [item.value for item in Dataset]
            )

    def validate_query(self, query: str):
        query_terms = query.split()
        for query_term in query_terms:
            if query_term in UNSUPPORTED_QUERIES:
                raise serializers.ValidationError(
                    f"Unsupported Query: We do not currently support the {query_term} query"
                )
        return query

    def validate_aggregate(self, value: str):
        allow_mri = features.has(
            "organizations:custom-metrics",
            self.context["organization"],
            actor=self.context.get("user", None),
        ) or features.has(
            "organizations:insights-alerts",
            self.context["organization"],
            actor=self.context.get("user", None),
        )
        allow_eap = features.has(
            "organizations:alerts-eap",
            self.context["organization"],
            actor=self.context.get("user", None),
        )
        try:
            if not check_aggregate_column_support(
                value,
                allow_mri=allow_mri,
                allow_eap=allow_eap,
            ):
                raise serializers.ValidationError(
                    "Invalid Metric: We do not currently support this field."
                )
        except InvalidSearchQuery as e:
            raise serializers.ValidationError(f"Invalid Metric: {e}")

        return translate_aggregate_field(value, allow_mri=allow_mri)

    def validate_event_types(self, value: Sequence[str]) -> list[SnubaQueryEventType.EventType]:
        try:
            return [SnubaQueryEventType.EventType[event_type.upper()] for event_type in value]
        except KeyError:
            raise serializers.ValidationError(
                "Invalid event_type, valid values are %s"
                % [item.name.lower() for item in SnubaQueryEventType.EventType]
            )

    def validate(self, data):
        data = super().validate(data)
        self._validate_query(data)

        query_type = data["query_type"]
        if query_type == SnubaQuery.Type.CRASH_RATE:
            data["event_types"] = []
        event_types = data.get("event_types")

        valid_event_types = QUERY_TYPE_VALID_EVENT_TYPES.get(query_type, set())
        if event_types and set(event_types) - valid_event_types:
            raise serializers.ValidationError(
                "Invalid event types for this dataset. Valid event types are %s"
                % sorted(et.name.lower() for et in valid_event_types)
            )

        return data

    def _validate_query(self, data):
        dataset = data.setdefault("dataset", Dataset.Events)

        if features.has(
            "organizations:custom-metrics",
            self.context["organization"],
            actor=self.context.get("user", None),
        ) or features.has(
            "organizations:insights-alerts",
            self.context["organization"],
            actor=self.context.get("user", None),
        ):
            column = get_column_from_aggregate(data["aggregate"], allow_mri=True)
            if is_mri(column) and dataset != Dataset.PerformanceMetrics:
                raise serializers.ValidationError(
                    "You can use an MRI only on alerts on performance metrics"
                )

        query_type = data.setdefault("query_type", query_datasets_to_type[dataset])

        valid_datasets = QUERY_TYPE_VALID_DATASETS[query_type]
        if dataset not in valid_datasets:
            raise serializers.ValidationError(
                "Invalid dataset for this query type. Valid datasets are %s"
                % sorted(dataset.name.lower() for dataset in valid_datasets)
            )

        if (
            not features.has(
                "organizations:mep-rollout-flag",
                self.context["organization"],
                actor=self.context.get("user", None),
            )
            and dataset == Dataset.PerformanceMetrics
            and query_type == SnubaQuery.Type.PERFORMANCE
        ):
            raise serializers.ValidationError(
                "This project does not have access to the `generic_metrics` dataset"
            )

        projects = data.get("projects")
        if not projects:
            # We just need a valid project id from the org so that we can verify
            # the query. We don't use the returned data anywhere, so it doesn't
            # matter which.
            projects = list(self.context["organization"].project_set.all()[:1])

        try:
            entity_subscription = get_entity_subscription(
                query_type,
                dataset=dataset,
                aggregate=data["aggregate"],
                time_window=int(timedelta(minutes=data["time_window"]).total_seconds()),
                extra_fields={
                    "org_id": projects[0].organization_id,
                    "event_types": data.get("event_types"),
                },
            )
        except UnsupportedQuerySubscription as e:
            raise serializers.ValidationError(f"{e}")

        # TODO(edward): Bypass snql query validation for EAP queries. Do we need validation for rpc requests?
        if dataset != Dataset.EventsAnalyticsPlatform:
            self._validate_snql_query(data, entity_subscription, projects)

    def _validate_snql_query(self, data, entity_subscription, projects):
        end = timezone.now()
        start = end - timedelta(minutes=10)
        try:
            query_builder = entity_subscription.build_query_builder(
                query=data["query"],
                project_ids=[p.id for p in projects],
                environment=data.get("environment"),
                params={
                    "organization_id": projects[0].organization_id,
                    "project_id": [p.id for p in projects],
                    "start": start,
                    "end": end,
                },
            )
        except (InvalidSearchQuery, ValueError, IncompatibleMetricsQuery) as e:
            raise serializers.ValidationError(f"Invalid Query or Metric: {e}")

        if not query_builder.are_columns_resolved():
            raise serializers.ValidationError(
                "Invalid Metric: Please pass a valid function for aggregation"
            )

        dataset = Dataset(data["dataset"].value)
        self._validate_time_window(data.get("time_window"), dataset)

        entity = Entity(Dataset.Events.value, alias=Dataset.Events.value)

        time_col = ENTITY_TIME_COLUMNS[get_entity_key_from_query_builder(query_builder)]
        query_builder.add_conditions(
            [
                Condition(Column(time_col, entity=entity), Op.GTE, start),
                Condition(Column(time_col, entity=entity), Op.LT, end),
            ]
        )
        query_builder.limit = Limit(1)

        try:
            query_builder.run_query(referrer="alertruleserializer.test_query")
        except Exception:
            logger.exception("Error while validating snuba alert rule query")
            raise serializers.ValidationError(
                "Invalid Query or Metric: An error occurred while attempting " "to run the query"
            )

    def _validate_time_window(self, value: int, dataset: Dataset):
        if dataset == Dataset.Metrics:
            if value not in CRASH_RATE_ALERTS_ALLOWED_TIME_WINDOWS:
                raise serializers.ValidationError(
                    "Invalid Time Window: Allowed time windows for crash rate alerts are: "
                    "30min, 1h, 2h, 4h, 12h and 24h"
                )
        return value

    def _validate_performance_dataset(self, dataset):
        if dataset != Dataset.Transactions:
            return dataset

        has_dynamic_sampling = features.has(
            "organizations:dynamic-sampling", self.context["organization"]
        )
        has_performance_metrics_flag = features.has(
            "organizations:mep-rollout-flag", self.context["organization"]
        )
        has_performance_metrics = has_dynamic_sampling and has_performance_metrics_flag

        has_on_demand_metrics = features.has(
            "organizations:on-demand-metrics-extraction",
            self.context["organization"],
        )

        if has_performance_metrics or has_on_demand_metrics:
            raise serializers.ValidationError(
                "Performance alerts must use the `generic_metrics` dataset"
            )

        return dataset

    def create_source(self, validated_data) -> QuerySubscription:
        snuba_query = create_snuba_query(
            query_type=validated_data["query_type"],
            dataset=validated_data["dataset"],
            query=validated_data["query"],
            aggregate=validated_data["aggregate"],
            time_window=timedelta(minutes=validated_data["time_window"]),
            resolution=timedelta(minutes=1),
            environment=validated_data["environment"],
            event_types=validated_data["event_types"],
        )
        return create_snuba_subscription(
            project=self.context["project"],
            subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
        )

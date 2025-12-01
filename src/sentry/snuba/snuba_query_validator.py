import logging
from collections.abc import Sequence
from datetime import timedelta
from typing import override

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from snuba_sdk import Column, Condition, Entity, Limit, Op

from sentry import features
from sentry.api.serializers.rest_framework import EnvironmentField
from sentry.exceptions import (
    IncompatibleMetricsQuery,
    InvalidSearchQuery,
    UnsupportedQuerySubscription,
)
from sentry.explore.utils import is_logs_enabled
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
    ExtrapolationMode,
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

# Allowed time windows (in seconds) for crash rate alerts
CRASH_RATE_ALERTS_ALLOWED_TIME_WINDOWS = [1800, 3600, 7200, 14400, 43200, 86400]


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
    SnubaQuery.Type.PERFORMANCE: {
        SnubaQueryEventType.EventType.TRANSACTION,
        SnubaQueryEventType.EventType.TRACE_ITEM_LOG,
        SnubaQueryEventType.EventType.TRACE_ITEM_SPAN,
    },
}


class SnubaQueryValidator(BaseDataSourceValidator[QuerySubscription]):
    query_type = serializers.IntegerField(required=False)
    dataset = serializers.CharField(required=True)
    query = serializers.CharField(required=True, allow_blank=True)
    aggregate = serializers.CharField(required=True)
    time_window = serializers.IntegerField(required=True)
    environment = EnvironmentField(required=True, allow_null=True)
    event_types = serializers.ListField(
        child=serializers.CharField(),
    )
    group_by = serializers.ListField(
        child=serializers.CharField(allow_blank=False, max_length=200),
        required=False,
        allow_empty=False,
    )
    extrapolation_mode = serializers.CharField(required=False, allow_null=True)

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
            "group_by",
            "extrapolation_mode",
        ]

    data_source_type_handler = QuerySubscriptionDataSourceHandler

    def __init__(self, *args, timeWindowSeconds=False, **kwargs):
        super().__init__(*args, **kwargs)
        # if true, time_window is interpreted as seconds.
        # if false, time_window is interpreted as minutes.
        # TODO: only accept time_window in seconds once AlertRuleSerializer is removed
        self.time_window_seconds = timeWindowSeconds

    def validate_aggregate(self, aggregate: str) -> str:
        """
        Reject upsampled_count() as user input. This function is reserved for internal use
        and will be applied automatically when appropriate. Users should specify count().
        """
        if aggregate == "upsampled_count()":
            raise serializers.ValidationError(
                "upsampled_count() is not allowed as user input. Use count() instead - "
                "it will be automatically converted to upsampled_count() when appropriate."
            )
        return aggregate

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

    def validate_event_types(self, value: Sequence[str]) -> list[SnubaQueryEventType.EventType]:
        try:
            validated = [SnubaQueryEventType.EventType[event_type.upper()] for event_type in value]
        except KeyError:
            raise serializers.ValidationError(
                "Invalid event_type, valid values are %s"
                % [item.name.lower() for item in SnubaQueryEventType.EventType]
            )

        if not is_logs_enabled(
            self.context["organization"], actor=self.context.get("user", None)
        ) and any([v for v in validated if v == SnubaQueryEventType.EventType.TRACE_ITEM_LOG]):
            raise serializers.ValidationError("You do not have access to the log alerts feature.")

        return validated

    def validate_extrapolation_mode(self, extrapolation_mode: str) -> ExtrapolationMode | None:
        if extrapolation_mode is not None:
            extrapolation_mode_enum = ExtrapolationMode.from_str(extrapolation_mode)
            if extrapolation_mode_enum is None:
                raise serializers.ValidationError(
                    f"Invalid extrapolation mode: {extrapolation_mode}"
                )
            return extrapolation_mode_enum

    def validate(self, data):
        data = super().validate(data)
        self._validate_aggregate(data)
        self._validate_query(data)

        data["group_by"] = self._validate_group_by(data.get("group_by"))

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

        dataset = data.get("dataset")
        if dataset == Dataset.EventsAnalyticsPlatform and event_types and len(event_types) > 1:
            raise serializers.ValidationError(
                "Multiple event types not allowed. Valid event types are %s"
                % sorted(et.name.lower() for et in valid_event_types)
            )

        return data

    def _validate_aggregate(self, data):
        dataset = data.setdefault("dataset", Dataset.Events)
        aggregate = data.get("aggregate")
        allow_mri = features.has(
            "organizations:custom-metrics",
            self.context["organization"],
            actor=self.context.get("user", None),
        ) or features.has(
            "organizations:insights-alerts",
            self.context["organization"],
            actor=self.context.get("user", None),
        )
        allow_eap = dataset == Dataset.EventsAnalyticsPlatform
        try:
            if not check_aggregate_column_support(
                aggregate,
                allow_mri=allow_mri,
                allow_eap=allow_eap,
            ):
                raise serializers.ValidationError(
                    {"aggregate": _("Invalid Metric: We do not currently support this field.")}
                )
        except InvalidSearchQuery as e:
            raise serializers.ValidationError({"aggregate": _(f"Invalid Metric: {e}")})

        data["aggregate"] = translate_aggregate_field(
            aggregate, allow_mri=allow_mri, allow_eap=allow_eap
        )

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
            column = get_column_from_aggregate(
                data["aggregate"],
                allow_mri=True,
                allow_eap=dataset == Dataset.EventsAnalyticsPlatform,
            )
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
                time_window=data["time_window"],
                extra_fields={
                    "org_id": projects[0].organization_id,
                    "event_types": data.get("event_types"),
                    "extrapolation_mode": data.get("extrapolation_mode"),
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
        time_window_seconds = value * 60 if not self.time_window_seconds else value

        if dataset == Dataset.Metrics:
            if time_window_seconds not in CRASH_RATE_ALERTS_ALLOWED_TIME_WINDOWS:
                raise serializers.ValidationError(
                    "Invalid Time Window: Allowed time windows for crash rate alerts are: "
                    "30min, 1h, 2h, 4h, 12h and 24h"
                )
        if dataset == Dataset.EventsAnalyticsPlatform:
            if time_window_seconds < 300:
                raise serializers.ValidationError(
                    "Invalid Time Window: Time window for this alert type must be at least 5 minutes."
                )
        return time_window_seconds

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

    def _validate_group_by(self, value: Sequence[str] | None) -> Sequence[str] | None:
        if value is None:
            return None

        if not features.has(
            "organizations:workflow-engine-metric-alert-group-by-creation",
            self.context["organization"],
            actor=self.context.get("user", None),
        ):
            raise serializers.ValidationError(
                "Group by Metric Alerts feature must be enabled to use this field"
            )

        if len(value) > 100:
            raise serializers.ValidationError("Group by must be 100 or fewer items")

        # group by has to be unique list of strings
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Group by must be a unique list of strings")

        # TODO:
        # validate that group by is a valid snql / EAP column?

        return value

    @override
    def create_source(self, validated_data) -> QuerySubscription:
        snuba_query = create_snuba_query(
            query_type=validated_data["query_type"],
            dataset=validated_data["dataset"],
            query=validated_data["query"],
            aggregate=validated_data["aggregate"],
            time_window=timedelta(seconds=validated_data["time_window"]),
            resolution=timedelta(minutes=1),
            environment=validated_data["environment"],
            event_types=validated_data["event_types"],
            group_by=validated_data.get("group_by"),
            extrapolation_mode=validated_data.get("extrapolation_mode"),
        )
        return create_snuba_subscription(
            project=self.context["project"],
            subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
        )

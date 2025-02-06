from collections.abc import Sequence
from datetime import timedelta

from rest_framework import serializers

from sentry import features
from sentry.api.serializers.rest_framework import EnvironmentField
from sentry.exceptions import InvalidSearchQuery
from sentry.incidents.logic import check_aggregate_column_support, translate_aggregate_field
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    QuerySubscriptionDataSourceHandler,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.workflow_engine.endpoints.validators.base import BaseDataSourceValidator
from sentry.workflow_engine.endpoints.validators.base.constants import (
    CRASH_RATE_ALERTS_ALLOWED_TIME_WINDOWS,
    UNSUPPORTED_QUERIES,
)


class SnubaQueryDataSourceValidator(BaseDataSourceValidator[QuerySubscription]):
    query_type = serializers.IntegerField(required=True)
    dataset = serializers.CharField(required=True)
    query = serializers.CharField(required=True)
    aggregate = serializers.CharField(required=True)
    time_window = serializers.IntegerField(required=True)
    environment = EnvironmentField(required=True, allow_null=True)
    event_types = serializers.ListField(
        child=serializers.IntegerField(),
    )

    data_source_type_handler = QuerySubscriptionDataSourceHandler

    def validate_query_type(self, value: int) -> SnubaQuery.Type:
        try:
            return SnubaQuery.Type(value)
        except ValueError:
            raise serializers.ValidationError(f"Invalid query type {value}")

    def validate_dataset(self, value: str) -> Dataset:
        try:
            return Dataset(value)
        except ValueError:
            raise serializers.ValidationError(
                f"Invalid dataset {value}. Must be one of: {', '.join(Dataset.__members__)}"
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

    # def validate_time_window(self, value: int, dataset: Dataset):
    def validate_time_window(self, value: int):
        # TODO need to call this elsewhere to be able to pass dataset in
        # if dataset == Dataset.Metrics:
        if value not in CRASH_RATE_ALERTS_ALLOWED_TIME_WINDOWS:
            raise serializers.ValidationError(
                "Invalid Time Window: Allowed time windows for crash rate alerts are: "
                "30min, 1h, 2h, 4h, 12h and 24h"
            )
        return timedelta(minutes=value)

    def validate_event_types(self, value: Sequence[int]) -> list[SnubaQueryEventType.EventType]:
        try:
            return [SnubaQueryEventType.EventType(t) for t in value]
        except ValueError:
            raise serializers.ValidationError(f"Invalid event type: {value}")

    # not migrated from alert_rule serializer:
    # _validate_query, _validate_snql_query, _validate_trigger_thresholds, _validate_critical_warning_triggers
    # _validate_performance_dataset, validate_threshold_type
    # do we need all of these?

    def create_source(self, validated_data) -> QuerySubscription:
        snuba_query = create_snuba_query(
            query_type=validated_data["query_type"],
            dataset=validated_data["dataset"],
            query=validated_data["query"],
            aggregate=validated_data["aggregate"],
            time_window=validated_data["time_window"],
            resolution=timedelta(minutes=1),
            environment=validated_data["environment"],
            event_types=validated_data["event_types"],
        )
        return create_snuba_subscription(
            project=self.context["project"],
            subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
        )

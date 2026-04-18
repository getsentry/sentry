import pytest
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from sentry.models.environment import Environment
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.endpoints.validators.base import DataSourceCreator


class SnubaQueryValidatorTest(TestCase):
    def setUp(self) -> None:
        self.valid_data = {
            "queryType": SnubaQuery.Type.ERROR.value,
            "dataset": Dataset.Events.value,
            "query": "test query",
            "aggregate": "count()",
            "timeWindow": 60,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
        }
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }

    def test_simple(self) -> None:
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid()
        assert validator.validated_data["query_type"] == SnubaQuery.Type.ERROR
        assert validator.validated_data["dataset"] == Dataset.Events
        assert validator.validated_data["query"] == "test query"
        assert validator.validated_data["aggregate"] == "count()"
        assert validator.validated_data["time_window"] == 60
        assert validator.validated_data["environment"] == self.environment
        assert validator.validated_data["event_types"] == [SnubaQueryEventType.EventType.ERROR]
        assert isinstance(validator.validated_data["_creator"], DataSourceCreator)

    def test_environment_get_or_create(self) -> None:
        new_env_name = "new-test-environment"
        assert not Environment.objects.filter(
            name=new_env_name, organization_id=self.project.organization_id
        ).exists()

        self.valid_data["environment"] = new_env_name
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid()

        env = validator.validated_data["environment"]
        assert isinstance(env, Environment)
        assert env.name == new_env_name
        assert env.organization_id == self.project.organization_id

    def test_invalid_query(self) -> None:
        unsupported_query = "release:latest"
        self.valid_data["query"] = unsupported_query
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("query") == [
            ErrorDetail(
                string=f"Unsupported Query: We do not currently support the {unsupported_query} query",
                code="invalid",
            )
        ]

    def test_invalid_query_type(self) -> None:
        invalid_query_type = 666
        self.valid_data["queryType"] = invalid_query_type
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("queryType") == [
            ErrorDetail(string=f"Invalid query type {invalid_query_type}", code="invalid")
        ]

    def test_validated_create_source_limits(self) -> None:
        with self.settings(MAX_QUERY_SUBSCRIPTIONS_PER_ORG=2):
            validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
            assert validator.is_valid()
            validator.validated_create_source(validator.validated_data)
            validator.validated_create_source(validator.validated_data)

            with pytest.raises(serializers.ValidationError) as e:
                validator.validated_create_source(validator.validated_data)
            assert e.value.detail == [
                ErrorDetail(
                    string="You may not exceed 2 data sources of this type.",
                    code="invalid",
                )
            ]

    def test_validated_create_source_limits_with_override(self) -> None:
        with self.settings(MAX_QUERY_SUBSCRIPTIONS_PER_ORG=2):
            with self.options(
                {
                    "metric_alerts.extended_max_subscriptions_orgs": [self.organization.id],
                    "metric_alerts.extended_max_subscriptions": 4,
                }
            ):
                validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
                assert validator.is_valid()
                validator.validated_create_source(validator.validated_data)
                validator.validated_create_source(validator.validated_data)
                validator.validated_create_source(validator.validated_data)
                validator.validated_create_source(validator.validated_data)

                with pytest.raises(serializers.ValidationError) as e:
                    validator.validated_create_source(validator.validated_data)
                assert e.value.detail == [
                    ErrorDetail(
                        string="You may not exceed 4 data sources of this type.",
                        code="invalid",
                    )
                ]

    def test_group_by_rejected(self) -> None:
        """Group by Metric Alerts is not enabled; any non-None group_by is rejected."""
        self.valid_data.update(
            {
                "queryType": SnubaQuery.Type.ERROR.value,
                "dataset": Dataset.Events.value,
                "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                "group_by": ["project", "environment"],
            }
        )

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert not validator.is_valid()
        assert validator.errors.get("nonFieldErrors") == [
            ErrorDetail(
                string="Group by Metric Alerts feature must be enabled to use this field",
                code="invalid",
            )
        ]

    def test_eap_user_misery_aggregate(self) -> None:
        data = {
            "dataset": Dataset.EventsAnalyticsPlatform.value,
            "query": "",
            "aggregate": "user_misery(span.duration,300)",
            "timeWindow": 60,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
        }
        validator = SnubaQueryValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        assert validator.validated_data["aggregate"] == "user_misery(span.duration,300)"

    @with_feature(
        {
            "organizations:performance-view": True,
            "organizations:tracemetrics-alerts": True,
            "organizations:tracemetrics-enabled": True,
            "organizations:custom-metrics": True,
        }
    )
    def test_trace_metrics_per_second_field(self) -> None:
        data = {
            "dataset": Dataset.EventsAnalyticsPlatform.value,
            "query": "",
            "aggregate": "per_second(value,sentry.apigateway.proxy_request,counter,none)",
            "timeWindow": 60,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_METRIC.name.lower()],
        }
        validator = SnubaQueryValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        assert (
            validator.validated_data["aggregate"]
            == "per_second(value,sentry.apigateway.proxy_request,counter,none)"
        )

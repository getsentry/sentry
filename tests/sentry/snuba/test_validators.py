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
            "timeWindow": 3600,
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
        assert validator.validated_data["time_window"] == 3600
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

    def test_time_window_out_of_bounds(self) -> None:
        for time_window in (0, 59, 86401, 604800):
            self.valid_data["timeWindow"] = time_window
            validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
            assert not validator.is_valid(), time_window
            assert validator.errors.get("nonFieldErrors") == [
                ErrorDetail(
                    string="Invalid Time Window: must be between 1 minute and 24 hours",
                    code="invalid",
                )
            ]

    def test_time_window_at_bounds(self) -> None:
        for time_window in (60, 86400):
            self.valid_data["timeWindow"] = time_window
            validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
            assert validator.is_valid(), validator.errors
            assert validator.validated_data["time_window"] == time_window

    def test_unsupported_dataset_with_query_type_returns_validation_error(self) -> None:
        """Spans dataset is a valid Dataset enum but is not alert-supported.

        query_type may already be present (as with detector create payloads).
        setdefault must not eagerly KeyError on the dataset mapping.
        """
        self.valid_data.update(
            {
                "queryType": SnubaQuery.Type.PERFORMANCE.value,
                "dataset": Dataset.SpansIndexed.value,
                "aggregate": "failure_rate()",
                "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
            }
        )
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()
        # Prefer a field/non-field validation error over an uncaught KeyError.
        assert validator.errors
        assert "dataset" in validator.errors or "nonFieldErrors" in validator.errors

    def test_unsupported_dataset_without_query_type_returns_validation_error(self) -> None:
        self.valid_data.pop("queryType", None)
        self.valid_data.update(
            {
                "dataset": Dataset.SpansIndexed.value,
                "aggregate": "failure_rate()",
                "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
            }
        )
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("dataset") == [
            ErrorDetail(string="Unsupported dataset for alerts: spans", code="invalid")
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
            "timeWindow": 3600,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
        }
        validator = SnubaQueryValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        assert validator.validated_data["aggregate"] == "user_misery(span.duration,300)"

    def test_eap_unparseable_equation_aggregate(self) -> None:
        data = {
            "dataset": Dataset.EventsAnalyticsPlatform.value,
            "query": "",
            "aggregate": "equation|sum(tags[foo,number]) / sum(tags[bar,number])",
            "timeWindow": 3600,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
        }
        validator = SnubaQueryValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert "aggregate" in validator.errors

    def _spans_equation_data(self, aggregate: str) -> dict[str, object]:
        return {
            "dataset": Dataset.EventsAnalyticsPlatform.value,
            "query": "span.op:gen_ai.chat",
            "aggregate": aggregate,
            "timeWindow": 3600,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
        }

    @with_feature("organizations:spans-monitor-equations")
    def test_eap_spans_equation_aggregate(self) -> None:
        for aggregate in [
            "equation|sum(gen_ai.usage.cache_read.input_tokens) / sum(gen_ai.usage.input_tokens)",
            "equation|opportunity_score(measurements.score.lcp) * 100",
        ]:
            with self.subTest(aggregate=aggregate):
                validator = SnubaQueryValidator(
                    data=self._spans_equation_data(aggregate), context=self.context
                )
                assert validator.is_valid(), validator.errors
                assert validator.validated_data["aggregate"] == aggregate

    def test_eap_spans_equation_aggregate_without_feature(self) -> None:
        validator = SnubaQueryValidator(
            data=self._spans_equation_data("equation|count() / count(span.duration)"),
            context=self.context,
        )
        assert not validator.is_valid()
        assert validator.errors["aggregate"] == [
            ErrorDetail(
                string="Invalid Metric: Span monitors do not support equations.", code="invalid"
            )
        ]

    @with_feature("organizations:spans-monitor-equations")
    def test_eap_spans_equation_invalid(self) -> None:
        for aggregate, error in [
            ("equation|count_sample() / count()", "count_sample() is not supported in monitors."),
            (
                "equation|span.duration / 1000",
                "An equation must combine aggregate functions, such as sum(a) / sum(b).",
            ),
            (
                "equation|sum(span.duration) / span.self_time",
                "Cannot mix functions and fields in arithmetic",
            ),
            (
                "equation|sum(span.duration) /",
                "Unable to parse your equation, make sure it is well formed arithmetic",
            ),
            ("equation|sum(span.op) / count()", "span.op is invalid for parameter 1 in sum"),
            ("equation|apdex(span.duration,foo) * 2", "could not convert string to float: 'foo'"),
        ]:
            with self.subTest(aggregate=aggregate):
                validator = SnubaQueryValidator(
                    data=self._spans_equation_data(aggregate), context=self.context
                )
                assert not validator.is_valid()
                assert str(validator.errors["aggregate"][0]).startswith(f"Invalid Metric: {error}")

    @with_feature(["organizations:ourlogs-enabled", "organizations:spans-monitor-equations"])
    def test_eap_logs_equation_aggregate(self) -> None:
        validator = SnubaQueryValidator(
            data={
                **self._spans_equation_data("equation|count() / count(message)"),
                "query": "",
                "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_LOG.name.lower()],
            },
            context=self.context,
        )
        assert not validator.is_valid()
        assert validator.errors["aggregate"] == [
            ErrorDetail(
                string="Invalid Metric: equation|count() / count(message) is not a valid function",
                code="invalid",
            )
        ]

    def test_eap_performance_score_aggregate(self) -> None:
        data = {
            "dataset": Dataset.EventsAnalyticsPlatform.value,
            "query": "",
            "aggregate": "performance_score(measurements.score.lcp)",
            "timeWindow": 3600,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
        }
        validator = SnubaQueryValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors

    def test_eap_opportunity_score_aggregate(self) -> None:
        data = {
            "dataset": Dataset.EventsAnalyticsPlatform.value,
            "query": "",
            "aggregate": "opportunity_score(measurements.score.lcp)",
            "timeWindow": 3600,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.name.lower()],
        }
        validator = SnubaQueryValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors

    @with_feature(
        {
            "organizations:performance-view": True,
            "organizations:tracemetrics-enabled": True,
            "organizations:custom-metrics": True,
        }
    )
    def test_trace_metrics_per_second_field(self) -> None:
        data = {
            "dataset": Dataset.EventsAnalyticsPlatform.value,
            "query": "",
            "aggregate": "per_second(value,sentry.apigateway.proxy_request,counter,none)",
            "timeWindow": 3600,
            "environment": self.environment.name,
            "eventTypes": [SnubaQueryEventType.EventType.TRACE_ITEM_METRIC.name.lower()],
        }
        validator = SnubaQueryValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        assert (
            validator.validated_data["aggregate"]
            == "per_second(value,sentry.apigateway.proxy_request,counter,none)"
        )

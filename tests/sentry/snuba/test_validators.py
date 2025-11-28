import pytest
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

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

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_valid_group_by(self) -> None:
        """Test that valid group_by data is accepted."""
        self.valid_data["group_by"] = ["project", "environment"]

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert validator.is_valid()
        assert validator.validated_data["group_by"] == ["project", "environment"]

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_empty_group_by(self) -> None:
        """Test that empty group_by list is rejected."""
        self.valid_data["group_by"] = []

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()

        # The serializer catches this before our custom validation
        assert "groupBy" in validator.errors

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_empty_group_by_string(self) -> None:
        """Test that empty group_by list is rejected."""
        self.valid_data["group_by"] = [""]

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert not validator.is_valid()
        assert "groupBy" in validator.errors

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_none_group_by(self) -> None:
        """Test that None group_by is handled correctly."""
        self.valid_data["group_by"] = None

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert not validator.is_valid()
        assert "groupBy" in validator.errors

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_invalid_group_by_not_list(self) -> None:
        """Test that non-list group_by raises validation error."""

        self.valid_data["group_by"] = "not_a_list"

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()

        assert "groupBy" in validator.errors

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_group_by_too_many_items(self) -> None:
        """Test that group_by with more than 100 items raises validation error."""

        self.valid_data["group_by"] = [f"field_{i}" for i in range(101)]

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert not validator.is_valid()
        assert validator.errors.get("nonFieldErrors") == [
            ErrorDetail(string="Group by must be 100 or fewer items", code="invalid")
        ]

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_group_by_duplicate_items(self) -> None:
        """Test that group_by with duplicate items raises validation error."""

        self.valid_data["group_by"] = ["project", "environment", "project"]

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert not validator.is_valid()
        assert validator.errors.get("nonFieldErrors") == [
            ErrorDetail(string="Group by must be a unique list of strings", code="invalid")
        ]

    def test_group_by_no_feature(self) -> None:
        """Test group_by with performance dataset."""
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

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_group_by_string_too_long(self) -> None:
        """Test that group_by with strings longer than 200 characters is rejected."""

        self.valid_data["group_by"] = ["project", "a" * 201, "environment"]

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert not validator.is_valid()
        assert "groupBy" in validator.errors

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_group_by_mixed_types(self) -> None:
        """Test that group_by with non-string items is converted to strings."""

        self.valid_data["group_by"] = ["project", 123, "environment"]

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert validator.is_valid()
        assert validator.validated_data["group_by"] == ["project", "123", "environment"]

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_group_by_with_valid_fields(self) -> None:
        """Test that common valid group_by fields are accepted."""

        valid_group_by_fields = [
            "project",
            "environment",
            "release",
            "user",
            "transaction",
            "message",
            "level",
            "type",
            "mechanism",
            "handled",
            "unhandled",
            "culprit",
            "title",
            "location",
            "function",
            "package",
            "sdk_name",
            "sdk_version",
            "device_name",
            "device_family",
            "device_model",
            "os_name",
            "os_version",
            "browser_name",
            "browser_version",
            "geo_country_code",
            "geo_region",
            "geo_city",
        ]

        for field in valid_group_by_fields:
            self.valid_data["group_by"] = [field]
            validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
            assert validator.is_valid(), f"Failed for field: {field}"
            assert validator.validated_data["group_by"] == [field]

    @with_feature("organizations:workflow-engine-metric-alert-group-by-creation")
    def test_group_by_multiple_valid_fields(self) -> None:

        self.valid_data["group_by"] = ["project", "environment", "release", "user"]

        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)

        assert validator.is_valid()
        assert validator.validated_data["group_by"] == ["project", "environment", "release", "user"]

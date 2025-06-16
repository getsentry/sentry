import pytest
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import DataSourceCreator


class SnubaQueryValidatorTest(TestCase):
    def setUp(self):
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

    def test_simple(self):
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

    def test_invalid_query(self):
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

    def test_invalid_query_type(self):
        invalid_query_type = 666
        self.valid_data["queryType"] = invalid_query_type
        validator = SnubaQueryValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("queryType") == [
            ErrorDetail(string=f"Invalid query type {invalid_query_type}", code="invalid")
        ]

    def test_validated_create_source_limits(self):
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

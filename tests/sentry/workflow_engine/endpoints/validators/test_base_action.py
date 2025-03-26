from unittest import mock

from rest_framework import serializers

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionHandler
from tests.sentry.workflow_engine.test_base import MockModel


class MockActionHandler(ActionHandler):
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Action Configuration",
        "type": "object",
        "properties": {
            "foo": {
                "type": ["string"],
            },
        },
        "required": ["foo"],
        "additionalProperties": False,
    }

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Action Data",
        "type": "object",
        "properties": {
            "baz": {
                "type": ["string"],
            },
        },
        "required": ["baz"],
        "additionalProperties": False,
    }


class MockActionValidator(BaseActionValidator[MockModel]):
    field1 = serializers.CharField()

    class Meta:
        model = MockModel
        fields = "__all__"


@mock.patch(
    "sentry.workflow_engine.registry.action_handler_registry.get",
    return_value=MockActionHandler,
)
class TestBaseActionValidator(TestCase):
    def setUp(self):
        super().setUp()
        self.valid_data = {
            "field1": "test",
            "type": Action.Type.SLACK,
            "config": {"foo": "bar"},
            "data": {"baz": "bar"},
        }

    def test_validate_type(self, mock_action_handler_get):
        validator = MockActionValidator(
            data={
                **self.valid_data,
                "type": Action.Type.SLACK,
            },
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_type__invalid(self, mock_action_handler_get):
        validator = MockActionValidator(
            data={
                **self.valid_data,
                "type": "invalid_test",
            }
        )

        result = validator.is_valid()
        assert result is False

    def test_validate_config(self, mock_action_handler_get):
        validator = MockActionValidator(
            data={
                **self.valid_data,
                "config": {"foo": "bar"},
            },
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_config__invalid(self, mock_action_handler_get):
        validator = MockActionValidator(
            data={
                **self.valid_data,
                "config": {"invalid": 1},
            },
        )

        result = validator.is_valid()
        assert result is False

    def test_validate_data(self, mock_action_handler_get):
        validator = MockActionValidator(
            data={
                **self.valid_data,
                "data": {"baz": "foo"},
            },
        )

        result = validator.is_valid()
        assert result is True

    def test_validate_data__invalid(self, mock_action_handler_get):
        validator = MockActionValidator(
            data={
                **self.valid_data,
                "data": {"invalid": 1},
            },
        )

        result = validator.is_valid()
        assert result is False

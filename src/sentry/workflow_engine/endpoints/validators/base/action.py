from typing import Any, Generic, TypeVar

from django.forms import ValidationError
from jsonschema import ValidationError as JsonValidationError
from jsonschema import validate
from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeModelSerializer
from sentry.db.models import Model
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler

T = TypeVar("T", bound=Model)
ActionData = dict[str, Any]
ActionConfig = dict[str, Any]


def validate_json_schema(value, schema):
    try:
        validate(value, schema)
    except JsonValidationError as e:
        raise ValidationError(str(e))

    return value


class BaseActionValidator(CamelSnakeModelSerializer[T], Generic[T]):
    data: Any = serializers.JSONField()
    config: Any = serializers.JSONField()

    class Meta:
        model = T
        fields = ["config", "data", "integration_id", "type"]

    def _get_action_handler(self) -> ActionHandler:
        initial_type = self.initial_data.get("type")
        action_type = self.validate_type(initial_type)
        return action_handler_registry.get(action_type)

    def validate_type(self, value) -> Action.Type:
        if not value:
            raise ValidationError("Action type is required")

        try:
            Action.Type(value)
        except ValueError:
            raise ValidationError(f"Invalid Action.type, {value}")

        return value

    def validate_data(self, value) -> ActionData:
        data_schema = self._get_action_handler().data_schema
        return validate_json_schema(value, data_schema)

    def validate_config(self, value) -> ActionConfig:
        config_schema = self._get_action_handler().config_schema
        return validate_json_schema(value, config_schema)

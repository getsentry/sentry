from typing import Any

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler

ActionData = dict[str, Any]
ActionConfig = dict[str, Any]


class BaseActionValidator(CamelSnakeSerializer):
    data: Any = serializers.JSONField()
    config: Any = serializers.JSONField()
    type = serializers.ChoiceField(choices=[(t.value, t.name) for t in Action.Type])
    integration_id = serializers.IntegerField(required=False)

    def _get_action_handler(self) -> ActionHandler:
        action_type = self.initial_data.get("type")
        return action_handler_registry.get(action_type)

    def validate_data(self, value) -> ActionData:
        data_schema = self._get_action_handler().data_schema
        return validate_json_schema(value, data_schema)

    def validate_config(self, value) -> ActionConfig:
        config_schema = self._get_action_handler().config_schema
        return validate_json_schema(value, config_schema)

    def create(self, validated_value: dict[str, Any]) -> Action:
        """
        TODO @saponifi3d -- add any org checks for creating actions here
        """
        return Action.objects.create(**validated_value)

    def update(self, instance: Action, validated_value: dict[str, Any]) -> Action:
        return instance.update(**validated_value)

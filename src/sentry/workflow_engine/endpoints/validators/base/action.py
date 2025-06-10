import builtins
from typing import Any

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.processors.action import is_action_permitted
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler

ActionData = dict[str, Any]
ActionConfig = dict[str, Any]


class BaseActionValidator(CamelSnakeSerializer):
    data: Any = serializers.JSONField()
    config: Any = serializers.JSONField()
    type = serializers.ChoiceField(choices=[(t.value, t.name) for t in Action.Type])
    integration_id = serializers.IntegerField(required=False)

    def _get_action_handler(self) -> builtins.type[ActionHandler]:
        action_type = self.initial_data.get("type")
        return action_handler_registry.get(action_type)

    def validate_data(self, value) -> ActionData:
        data_schema = self._get_action_handler().data_schema
        return validate_json_schema(value, data_schema)

    def validate_config(self, value) -> ActionConfig:
        config_schema = self._get_action_handler().config_schema
        return validate_json_schema(value, config_schema)

    def validate_type(self, value) -> Any:
        try:
            action_type = Action.Type(value)
        except ValueError:
            raise serializers.ValidationError(f"Invalid action type: {value}")
        self._check_action_type(action_type)
        return value

    def _check_action_type(self, action_type: Action.Type) -> None:
        organization = self.context.get("organization")
        if not organization:
            # ¯\_(ツ)_/¯
            # TODO(kylec): Require organization to be in the context.
            return
        if not is_action_permitted(action_type, organization):
            raise serializers.ValidationError(
                f"Organization does not allow this action type: {action_type}"
            )

    def create(self, validated_value: dict[str, Any]) -> Action:
        """ """
        self._check_action_type(Action.Type(validated_value["type"]))
        return Action.objects.create(**validated_value)

    def update(self, instance: Action, validated_value: dict[str, Any]) -> Action:
        if instance.type != validated_value["type"]:
            self._check_action_type(Action.Type(validated_value["type"]))
        instance.update(**validated_value)
        return instance

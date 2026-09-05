from typing import Any, NotRequired, TypedDict

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.processors.action import is_action_permitted
from sentry.workflow_engine.registry import action_handler_registry

DEPRECATED_ACTION_TYPES: frozenset[Action.Type] = frozenset({Action.Type.PLUGIN})


class ActionInput(TypedDict):
    id: NotRequired[str]
    type: str
    data: dict[str, Any]
    config: dict[str, Any]
    integrationId: NotRequired[int | None]
    status: NotRequired[str]


class BaseActionValidator(CamelSnakeSerializer[Any]):
    data = serializers.JSONField()  # type: ignore[assignment]
    config = serializers.JSONField()
    type = serializers.ChoiceField(choices=[(t.value, t.name) for t in Action.Type])
    integration_id = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.CharField(required=False)

    def validate_status(self, value: Any) -> int:
        if value is None:
            return ObjectStatus.ACTIVE
        if isinstance(value, str):
            return ObjectStatus.from_str(value)
        return value

    def validate_type(self, value: str) -> Action.Type:
        action_type = Action.Type(value)
        if action_type in DEPRECATED_ACTION_TYPES:
            raise serializers.ValidationError(
                f"Action type {value} is deprecated and cannot be created."
            )
        self._check_action_type(action_type)
        return action_type

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

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        from sentry.notifications.notification_action.registry import action_validator_registry

        if not (organization := self.context.get("organization")):
            raise serializers.ValidationError("Organization is required in the context")

        attrs = super().validate(attrs)

        action_type: Action.Type = attrs["type"]
        action_handler = action_handler_registry.get(action_type)
        errors: dict[str, list[str]] = {}

        try:
            attrs["data"] = validate_json_schema(attrs["data"], action_handler.data_schema)
        except DjangoValidationError as error:
            errors["data"] = error.messages

        try:
            config_transformer = action_handler.get_config_transformer()
            if config_transformer is not None:
                attrs["config"] = config_transformer.from_api(attrs["config"])
            else:
                attrs["config"] = validate_json_schema(
                    attrs["config"], action_handler.config_schema
                )
        except DjangoValidationError as error:
            errors["config"] = error.messages

        if errors:
            raise serializers.ValidationError(errors)

        is_integration = action_type.is_integration()
        has_integration_id = attrs.get("integration_id") is not None

        if not is_integration and has_integration_id:
            raise serializers.ValidationError(
                f"Integration ID is not allowed for action type {attrs['type']}"
            )
        if is_integration and not has_integration_id:
            raise serializers.ValidationError(
                f"Integration ID is required for action type {attrs['type']}"
            )

        try:
            handler = action_validator_registry.get(action_type)
        except NoRegistrationExistsError:
            return attrs

        return handler(attrs, organization).clean_data()

    def create(self, validated_value: dict[str, Any]) -> Action:
        self._check_action_type(Action.Type(validated_value["type"]))
        return Action.objects.create(**validated_value)

    def update(self, instance: Action, validated_value: dict[str, Any]) -> Action:
        if instance.type != validated_value["type"]:
            self._check_action_type(Action.Type(validated_value["type"]))
        instance.update(**validated_value)
        return instance

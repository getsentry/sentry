from typing import Generic, TypeVar

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.db.models import Model
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.endpoints.validators.utils import (
    validate_json_primitive,
    validate_json_schema,
)
from sentry.workflow_engine.models.data_condition import CONDITION_OPS, Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler

T = TypeVar("T", bound=Model)


class BaseDataConditionValidator(CamelSnakeSerializer[T], Generic[T]):
    type = serializers.ChoiceField(choices=[(t.value, t.value) for t in Condition])

    comparison = serializers.JSONField(required=True)
    condition_result = serializers.JSONField(required=True)
    # condition_group_id = serializers.IntegerField(required=True)

    def _get_handler(self) -> DataConditionHandler | None:
        condition_type = self.initial_data.get("type")
        if condition_type in CONDITION_OPS:
            return None

        try:
            return condition_handler_registry.get(condition_type)
        except NoRegistrationExistsError:
            raise serializers.ValidationError(f"Invalid condition type: {condition_type}")

    def validate_comparison(self, value):
        handler = self._get_handler()

        if handler:
            schema = handler.comparison_json_schema
            validate_json_schema(value, schema)
        else:
            validate_json_primitive(value)

        return value

    def validate_condition_result(self, value):
        return validate_json_primitive(value)

    def validate_condition_group(self, value):
        # TODO - validate that the condition group exists
        # TODO - validate they have permissions to access the group?
        return value

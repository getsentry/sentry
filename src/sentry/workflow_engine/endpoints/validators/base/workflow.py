from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeModelSerializer
from sentry.workflow_engine.endpoints.validators.base import (  # DataConditionGroupActionValidator,
    BaseDataConditionGroupValidator,
)
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.models import Workflow


class BaseWorkflowValidator(CamelSnakeModelSerializer):
    name = serializers.CharField(max_length=256)
    enabled = serializers.BooleanField(default=True)
    organization = serializers.IntegerField(required=True)
    environment_id = serializers.IntegerField(required=False, allow_null=True)
    created_by_id = serializers.IntegerField()

    class Meta:
        model = Workflow
        fields = "__all__"

    def validate_when_condition_group(self, value):
        return BaseDataConditionGroupValidator().validate(value)

    def validate_config(self, value):
        schema = Workflow.config_schema
        validate_json_schema(value, schema)

    def validate_actions(self, value):
        raise NotImplementedError
        # return DataConditionGroupActionValidator().validate(value)

    def update(self, instance, validated_data):
        # TODO - @saponifi3d - implement this
        raise NotImplementedError

    def create(self, validated_data):
        # TODO - @saponifi3d - implement this
        raise NotImplementedError

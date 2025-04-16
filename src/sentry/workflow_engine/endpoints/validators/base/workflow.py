from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionGroupValidator
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.models import Workflow


class WorkflowValidator(CamelSnakeSerializer):
    name = serializers.CharField(required=True, max_length=256)
    enabled = serializers.BooleanField(required=False, default=True)
    config = serializers.JSONField(required=False)
    triggers = BaseDataConditionGroupValidator(required=False)
    action_filters = serializers.ListField(child=BaseDataConditionGroupValidator(), required=False)

    # TODO - Need to improve the following fields (validate them in db)
    organization_id = serializers.IntegerField(required=True)
    environment_id = serializers.IntegerField(required=False)

    def validate_config(self, value):
        schema = Workflow.config_schema
        return validate_json_schema(value, schema)

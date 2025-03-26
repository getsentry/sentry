from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator


class BaseDataConditionGroupValidator(CamelSnakeSerializer):
    logic_type = serializers.CharField(required=True)
    organization_id = serializers.IntegerField(required=True)
    conditions = serializers.ListField(child=BaseDataConditionValidator(), required=False)

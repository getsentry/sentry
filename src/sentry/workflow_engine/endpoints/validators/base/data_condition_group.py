from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.models import DataConditionGroup


class BaseDataConditionGroupValidator(CamelSnakeSerializer):
    logic_type = serializers.ChoiceField([(t.value, t.value) for t in DataConditionGroup.Type])
    organization_id = serializers.IntegerField(required=True)
    conditions = serializers.ListField(required=False)

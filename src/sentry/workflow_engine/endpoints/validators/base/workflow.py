from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeModelSerializer
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Workflow


class WorkflowValidator(CamelSnakeModelSerializer):
    name = serializers.CharField(max_length=256)
    enabled = serializers.BooleanField(default=True)
    # organization = FlexibleForeignKey("sentry.Organization")
    # when_condition_group = FlexibleForeignKey("workflow_engine.DataConditionGroup", null=True, blank=True)
    # environment = FlexibleForeignKey("sentry.Environment", null=True, blank=True)
    # created_by_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True)

    class Meta:
        model = Workflow
        fields = "__all__"

    def actions(self) -> BaseActionValidator:
        # TODO - @saponifi3d - implement this
        raise NotImplementedError

    def validate_when_condition_group(self, value):
        # TODO - @saponifi3d - implement this
        raise NotImplementedError

    def update(self, instance, validated_data):
        # TODO - @saponifi3d - implement this
        raise NotImplementedError

    def create(self, validated_data):
        # TODO - @saponifi3d - implement this
        raise NotImplementedError

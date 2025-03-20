from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer


class DetectorWorkflowValidator(CamelSnakeSerializer):
    detector_id = serializers.IntegerField(required=True)
    workflow_id = serializers.IntegerField(required=True)

from typing import Any

from rest_framework import serializers


class DetectorWorkflowMutationValidator(serializers.Serializer[Any]):
    enabled = serializers.BooleanField(required=True)

from typing import int
from rest_framework import serializers


class DetectorWorkflowMutationValidator(serializers.Serializer):
    enabled = serializers.BooleanField(required=True)

from typing import Any

from rest_framework.exceptions import PermissionDenied

from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.registry import detector_validator_registry
from sentry.workflow_engine.types import GROUP_TYPE_ISSUE_STREAM


@detector_validator_registry.register(GROUP_TYPE_ISSUE_STREAM)
class IssueStreamDetectorValidator(BaseDetectorTypeValidator):
    """
    Issue stream detectors are created by Sentry itself. This validator exists to carry the
    config schema enforced on save, and refuses to create or update detectors through the API.
    """

    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {"organization_id": {"type": "integer"}},
        "additionalProperties": False,
    }
    data_source_required = False

    def create(self, validated_data: dict[str, Any]) -> Detector:
        raise PermissionDenied("Creating issue stream detectors is not supported")

    def update(self, instance: Detector, validated_data: dict[str, Any]) -> Detector:
        raise PermissionDenied("Updating issue stream detectors is not supported")

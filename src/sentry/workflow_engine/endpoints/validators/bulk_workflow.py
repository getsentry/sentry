from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer


class BulkWorkflowMutationValidator(CamelSnakeSerializer):
    """
    Validator for bulk workflow operations (PUT/DELETE).
    Validates filtering parameters and operation-specific fields.
    """

    # Filtering parameters
    id = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="List of workflow IDs to filter by",
    )
    query = serializers.CharField(
        required=False, allow_blank=True, help_text="Search query to filter workflows"
    )
    project = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="List of project IDs to filter by",
    )
    project_slug = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        help_text="List of project slugs to filter by",
    )

    def __init__(self, data=None, *args, **kwargs):
        """Initialize validator and extract data from request if no data provided."""
        if data is None:
            # Extract data from request in context
            request = kwargs.get("context", {}).get("request")
            if request is not None:
                data = self._extract_data_from_request(request)

        super().__init__(data=data, *args, **kwargs)

    def _extract_data_from_request(self, request: Request) -> dict[str, Any]:
        data = {
            "id": request.GET.getlist("id"),
            "query": request.GET.get("query"),
            "project": request.GET.getlist("project"),
            "project_slug": request.GET.getlist("projectSlug"),
        }

        # Remove empty/None values to avoid validation issues
        return {k: v for k, v in data.items() if v}

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)

        # Validate that at least one filtering parameter is provided
        filtering_params = ["id", "query", "project", "project_slug"]
        has_filtering_param = any(attrs.get(param) for param in filtering_params)

        if not has_filtering_param:
            raise ValidationError(
                {
                    "detail": "At least one of 'id', 'query', 'project', or 'projectSlug' must be provided."
                }
            )

        return attrs


class BulkWorkflowUpdateValidator(BulkWorkflowMutationValidator):
    """Validator specifically for bulk workflow update (PUT) operations."""

    enabled = serializers.BooleanField(
        required=True, help_text="Whether to enable or disable workflows"
    )

    def _extract_data_from_request(self, request: Request) -> dict[str, Any]:
        """Extract validation data from the request object including enabled field."""
        data = super()._extract_data_from_request(request)

        # Add enabled field from request body
        enabled = request.data.get("enabled")
        if enabled is not None:
            data["enabled"] = enabled

        return data

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """Validate that required filtering parameters and enabled field are provided."""
        attrs = super().validate(attrs)

        # For PUT operations, 'enabled' field is required
        if "enabled" not in attrs or attrs["enabled"] is None:
            raise ValidationError(
                {"enabled": "'enabled' must be provided for bulk update operations."}
            )

        return attrs

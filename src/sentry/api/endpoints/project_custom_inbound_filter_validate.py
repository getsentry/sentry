from __future__ import annotations

import logging
from typing import Any, TypedDict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.endpoints.project_custom_inbound_filters import (
    CustomInboundFilterCondition,
    CustomInboundFilterSerializer,
    ProjectCustomInboundFilterEndpoint,
)
from sentry.apidocs.response_types import DetailResponse, as_validation_errors
from sentry.models.custominboundfilter import CustomInboundFilter
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.oneshot import run_oneshot
from sentry.utils import metrics

logger = logging.getLogger(__name__)

NAME_MAX_LENGTH = CustomInboundFilter._meta.get_field("name").max_length


def suggest_filter_name(
    data_type: str,
    conditions: list[CustomInboundFilterCondition],
    organization: Organization,
    user_id: int | None,
) -> str | None:
    """
    Ask Seer's `inbound_filter_name` one-shot for a name that describes the filter.
    Returns None when Seer is unavailable or answers with nothing usable, so a
    suggestion never blocks the caller.
    """
    try:
        result = run_oneshot(
            "inbound_filter_name",
            {"data_type": data_type, "conditions": conditions},
            organization,
            user_id=user_id,
            timeout=10,
        )
    except Exception:
        logger.exception("custom_inbound_filters.name_suggestion.failed")
        metrics.incr("custom_inbound_filters.name_suggestion", tags={"result": "request_error"})
        return None

    name = result.get("name")
    if not isinstance(name, str) or not name.strip():
        metrics.incr("custom_inbound_filters.name_suggestion", tags={"result": "empty"})
        return None

    metrics.incr("custom_inbound_filters.name_suggestion", tags={"result": "success"})
    return name.strip()[:NAME_MAX_LENGTH]


class CustomInboundFilterValidationResponse(TypedDict):
    errors: dict[str, Any]
    suggestedName: str | None


@cell_silo_endpoint
class CustomInboundFilterValidateEndpoint(ProjectCustomInboundFilterEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(
        self, request: Request, project: Project
    ) -> Response[CustomInboundFilterValidationResponse] | Response[DetailResponse]:
        """
        Check a filter definition without saving it, and suggest a name for it.

        The body is the one the create endpoint takes. Pass `id` to check an edit of an
        existing filter, so the checks that depend on the stored filter apply. `errors`
        holds what the create or update endpoint would refuse, in the same shape. It is
        empty when the definition is valid. `suggestedName` is set when the definition
        is valid, the organization has the name suggestion feature and has not hidden
        AI features, and Seer answered.
        """
        if not self.has_feature(request, project):
            return Response({"detail": "You do not have that feature enabled"}, status=400)

        filter_id = request.data.get("id")
        stored = (
            self.get_custom_inbound_filter(project, filter_id) if filter_id is not None else None
        )
        serializer = CustomInboundFilterSerializer(
            stored,
            data=request.data,
            context={"project": project, "request": request},
        )
        if not serializer.is_valid():
            return Response({"errors": as_validation_errors(serializer), "suggestedName": None})

        organization = project.organization
        if not features.has(
            "organizations:inbound-filters-name-suggestion", organization, actor=request.user
        ) or organization.get_option("sentry:hide_ai_features", False):
            return Response({"errors": {}, "suggestedName": None})

        suggested_name = suggest_filter_name(
            serializer.validated_data["data_type"],
            serializer.validated_data["conditions"],
            organization,
            user_id=request.user.id,
        )
        return Response({"errors": {}, "suggestedName": suggested_name})

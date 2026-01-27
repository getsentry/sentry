from __future__ import annotations

import logging
from typing import Any

import orjson
import requests
from django.conf import settings
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.seer.endpoints.trace_explorer_ai_setup import OrganizationTraceExplorerAIPermission
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils.dates import get_timezone_choices

logger = logging.getLogger(__name__)

TIMEZONE_CHOICES = get_timezone_choices()


class SearchAgentTranslateSerializer(serializers.Serializer):
    project_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=False,
        help_text="List of project IDs to search in.",
    )
    natural_language_query = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="Natural language query to translate.",
    )
    strategy = serializers.CharField(
        required=False,
        default="Traces",
        help_text="Search strategy to use.",
    )
    timezone = serializers.ChoiceField(
        choices=TIMEZONE_CHOICES,
        required=False,
        allow_null=True,
        help_text="User's timezone (IANA timezone name, e.g., 'America/Los_Angeles').",
    )
    options = serializers.DictField(
        required=False,
        allow_null=True,
        help_text="Optional configuration options.",
    )

    def validate_options(self, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        if "model_name" in value and not isinstance(value["model_name"], str):
            raise serializers.ValidationError("model_name must be a string")
        return value


def send_translate_agentic_request(
    org_id: int,
    org_slug: str,
    project_ids: list[int],
    natural_language_query: str,
    strategy: str = "Traces",
    model_name: str | None = None,
    timezone: str | None = None,
) -> Any:
    """
    Sends a request to seer to translate a natural language query using the agentic search API.
    """
    body_dict: dict[str, Any] = {
        "org_id": org_id,
        "org_slug": org_slug,
        "project_ids": project_ids,
        "natural_language_query": natural_language_query,
        "strategy": strategy,
    }

    if timezone is not None:
        body_dict["timezone"] = timezone

    options: dict[str, Any] = {}
    if model_name is not None:
        options["model_name"] = model_name

    if options:
        body_dict["options"] = options

    body = orjson.dumps(body_dict)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/assisted-query/translate-agentic",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )
    response.raise_for_status()
    return response.json()


@region_silo_endpoint
class SearchAgentTranslateEndpoint(OrganizationEndpoint):
    """
    Endpoint to call Seer's agentic search API for translating natural language queries.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    permission_classes = (OrganizationTraceExplorerAIPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Request to translate a natural language query using the agentic search API.
        """
        serializer = SearchAgentTranslateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        natural_language_query = validated_data["natural_language_query"]
        strategy = validated_data.get("strategy", "Traces")
        timezone = validated_data.get("timezone")
        options = validated_data.get("options") or {}
        model_name = options.get("model_name")

        projects = self.get_projects(
            request, organization, project_ids=set(validated_data["project_ids"])
        )
        project_ids = [project.id for project in projects]

        if not features.has("organizations:seer-explorer", organization, actor=request.user):
            return Response(
                {"detail": "Feature flag not enabled"},
                status=status.HTTP_403_FORBIDDEN,
            )

        has_seer_access, detail = has_seer_access_with_detail(organization, actor=request.user)
        if not has_seer_access:
            return Response(
                {"detail": detail},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not settings.SEER_AUTOFIX_URL:
            return Response(
                {"detail": "Seer is not properly configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        data = send_translate_agentic_request(
            organization.id,
            organization.slug,
            project_ids,
            natural_language_query,
            strategy=strategy,
            model_name=model_name,
            timezone=timezone,
        )
        return Response(data)

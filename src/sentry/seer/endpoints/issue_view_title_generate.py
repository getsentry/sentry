from __future__ import annotations

import logging

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer.oneshot import run_oneshot

logger = logging.getLogger(__name__)


class IssueViewTitleGenerateSerializer(serializers.Serializer):
    query = serializers.CharField(required=True, allow_blank=False)


class IssueViewTitleGeneratePermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


def generate_title_from_query(
    query: str, organization: Organization, user_id: int | None = None
) -> str | None:
    result = run_oneshot(
        "issue_view_title",
        {"query": query},
        organization,
        user_id=user_id,
        timeout=10,
    )
    title = result.get("title")
    return title if isinstance(title, str) else None


@cell_silo_endpoint
class IssueViewTitleGenerateEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (IssueViewTitleGeneratePermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        serializer = IssueViewTitleGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        query = serializer.validated_data["query"]

        if organization.get_option("sentry:hide_ai_features", False):
            return Response(
                {"detail": "AI features are disabled for this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            title = generate_title_from_query(query, organization, user_id=request.user.id)
            if not title or not title.strip():
                logger.error(
                    "No title returned from Seer",
                    extra={"query_length": len(query)},
                )
                return Response(
                    {"detail": "No title returned from Seer"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response({"title": title.strip()})
        except Exception:
            logger.exception(
                "Failed to call Seer LLM proxy",
                extra={"query_length": len(query)},
            )
            return Response(
                {"detail": "Failed to generate title"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

from __future__ import annotations

from django.http import HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environment_func
from sentry.api.serializers import SharedGroupSerializer, serialize
from sentry.issues.endpoints.shared_group_markdown import format_shared_issue_as_markdown
from sentry.models.group import Group


@region_silo_endpoint
class SharedGroupDetailsEndpoint(Endpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = ()

    def _is_markdown_requested(self, request: Request) -> bool:
        """
        Determine if the client is requesting markdown format.

        Checks:
        1. Accept header contains text/markdown or text/plain
        2. User-Agent indicates an AI agent (cursor, claude, chatgpt, etc.)
        """
        # Check Accept header
        accept_header = request.META.get("HTTP_ACCEPT", "")
        if "text/markdown" in accept_header.lower() or "text/plain" in accept_header.lower():
            return True

        # Check User-Agent for common AI agents
        user_agent = request.META.get("HTTP_USER_AGENT", "").lower()
        ai_agent_patterns = [
            "cursor",
            "claude",
            "chatgpt",
            "gpt-",
            "openai",
            "anthropic",
            "copilot",
            "github-copilot",
            "ai-agent",
        ]
        if any(pattern in user_agent for pattern in ai_agent_patterns):
            return True

        return False

    def get(
        self,
        request: Request,
        organization_id_or_slug: int | str | None = None,
        share_id: str | None = None,
    ) -> Response | HttpResponse:
        """
        Retrieve an aggregate

        Return details on an individual aggregate specified by it's shared ID.

            {method} {path}

        Note: This is not the equivalent of what you'd receive with the standard
        group details endpoint. Data is more restrictive and designed
        specifically for sharing.

        """
        if share_id is None:
            raise ResourceDoesNotExist

        try:
            group = Group.objects.from_share_id(share_id)
        except Group.DoesNotExist:
            raise ResourceDoesNotExist

        # Checks if the organization_id_or_slug matches the group organization's id or slug
        if organization_id_or_slug:
            if str(organization_id_or_slug).isdecimal():
                if int(organization_id_or_slug) != group.organization.id:
                    raise ResourceDoesNotExist
            else:
                if organization_id_or_slug != group.organization.slug:
                    raise ResourceDoesNotExist

        if group.organization.flags.disable_shared_issues:
            raise ResourceDoesNotExist

        context = serialize(
            group,
            request.user,
            SharedGroupSerializer(
                environment_func=get_environment_func(request, group.project.organization_id)
            ),
        )

        # Return markdown if requested by AI agent
        if self._is_markdown_requested(request):
            markdown_content = format_shared_issue_as_markdown(context)
            return HttpResponse(markdown_content, content_type="text/markdown; charset=utf-8")

        return Response(context)

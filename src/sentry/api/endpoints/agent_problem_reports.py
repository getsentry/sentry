from __future__ import annotations

from typing import Any, Protocol, cast
from urllib.parse import urlparse
from uuid import UUID

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.agent_reports.submit import submit_agent_problem_report
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import DisallowAgentToken, SentryIsAuthenticated
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

_AREAS = ("mcp", "api", "documentation")


class _Reporter(Protocol):
    id: int
    email: str
    username: str

    def get_display_name(self) -> str: ...


class AgentProblemReportSerializer(serializers.Serializer):
    area = serializers.ChoiceField(choices=[(area, area) for area in _AREAS])
    summary = serializers.CharField(max_length=200, trim_whitespace=True)
    expected = serializers.CharField(max_length=2000, trim_whitespace=True)
    observed = serializers.CharField(max_length=2000, trim_whitespace=True)
    reproductionSteps = serializers.ListField(
        child=serializers.CharField(max_length=500, trim_whitespace=True),
        required=False,
        allow_empty=True,
        max_length=20,
    )
    toolName = serializers.CharField(
        required=False, allow_blank=True, max_length=120, trim_whitespace=True
    )
    apiEndpoint = serializers.CharField(
        required=False, allow_blank=True, max_length=500, trim_whitespace=True
    )
    documentationUrl = serializers.URLField(required=False, allow_blank=True, max_length=500)
    requestId = serializers.CharField(
        required=False, allow_blank=True, max_length=128, trim_whitespace=True
    )
    eventId = serializers.CharField(
        required=False, allow_blank=True, max_length=36, trim_whitespace=True
    )
    additionalContext = serializers.CharField(
        required=False, allow_blank=True, max_length=2000, trim_whitespace=True
    )

    def validate_documentationUrl(self, value: str) -> str:
        if not value:
            return value
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise serializers.ValidationError("Enter an http or https URL.")
        if parsed.username or parsed.password:
            raise serializers.ValidationError("URL must not include credentials.")
        return value

    def validate_eventId(self, value: str) -> str:
        if not value:
            return value
        try:
            UUID(value)
        except ValueError:
            raise serializers.ValidationError("Enter a UUID event id.") from None
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        steps = attrs.get("reproductionSteps") or []
        attrs["reproductionSteps"] = [step for step in steps if isinstance(step, str) and step]
        return attrs


@control_silo_endpoint
class AgentProblemReportsEndpoint(Endpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SentryIsAuthenticated, DisallowAgentToken)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=30, window=3600),
                RateLimitCategory.USER: RateLimit(limit=10, window=3600),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=30, window=3600),
            }
        }
    )

    def post(self, request: Request) -> Response:
        """
        File a report about the Sentry MCP, REST API, or documentation.

        Agents should explain the problem to the user and submit only after
        the user agrees. The body is scrubbed for common secrets and email
        addresses, then stored as User Feedback.
        """
        if not options.get("agent.problem-reports.enabled"):
            return Response(status=404)

        serializer = AgentProblemReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        # Control-silo requests expose an RPC user, which is not the ORM model.
        reporter = cast(_Reporter, request.user)
        report = submit_agent_problem_report(
            reporter_id=reporter.id,
            reporter_email=reporter.email or "",
            reporter_name=reporter.get_display_name() or "",
            reporter_username=reporter.username or "",
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            area=data["area"],
            summary=data["summary"],
            expected=data["expected"],
            observed=data["observed"],
            reproduction_steps=data.get("reproductionSteps") or [],
            tool_name=data.get("toolName") or "",
            api_endpoint=data.get("apiEndpoint") or "",
            documentation_url=data.get("documentationUrl") or "",
            request_id=data.get("requestId") or "",
            event_id=data.get("eventId") or "",
            additional_context=data.get("additionalContext") or "",
        )
        return Response({"id": report.id, "delivered": report.delivered}, status=201)

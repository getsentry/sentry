import logging
import time
from enum import StrEnum
from typing import TypedDict

import jwt as pyjwt
from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from pydantic import BaseModel
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.seer.auth import SeerRpcViewerContextAuthentication
from sentry.seer.seer_setup import has_seer_access
from sentry.viewer_context import _key_id

logger = logging.getLogger(__name__)

LLM_PROXY_JWT_TTL = 3600


class LlmProxyFeature(StrEnum):
    ANOMALY_DETECTION = "anomaly_detection"
    ASSISTED_QUERY = "assisted_query"
    AUTOFIX = "autofix"
    CODE_REVIEW = "code_review"
    EXPLORER = "explorer"
    GROUPING = "grouping"
    ISSUE_DETECTION = "issue_detection"
    MALICIOUS_ISSUE_DETECTION = "malicious_issue_detection"
    PR_METRICS = "pr_metrics"
    SEVERITY = "severity"
    SUMMARIZATION = "summarization"
    WORKFLOWS = "workflows"


FEATURE_FLAGS: dict[LlmProxyFeature, list[str]] = {
    LlmProxyFeature.ANOMALY_DETECTION: [],
    LlmProxyFeature.ASSISTED_QUERY: [],
    LlmProxyFeature.AUTOFIX: [],
    LlmProxyFeature.CODE_REVIEW: ["organizations:code-review-beta"],
    LlmProxyFeature.EXPLORER: ["organizations:seer-explorer"],
    LlmProxyFeature.GROUPING: [],
    LlmProxyFeature.ISSUE_DETECTION: ["organizations:ai-issue-detection"],
    LlmProxyFeature.MALICIOUS_ISSUE_DETECTION: [],
    LlmProxyFeature.PR_METRICS: [],
    LlmProxyFeature.SEVERITY: [],
    LlmProxyFeature.SUMMARIZATION: [],
    LlmProxyFeature.WORKFLOWS: [],
}


class LlmProxyKeyError(StrEnum):
    UNKNOWN_FEATURE = "unknown_feature"
    SIGNING_SECRET_NOT_CONFIGURED = "signing_secret_not_configured"
    ORGANIZATION_NOT_FOUND = "organization_not_found"
    FEATURE_NOT_ENABLED = "feature_not_enabled"
    PROJECT_NOT_FOUND = "project_not_found"


class MakeLlmProxyKeyResponse(BaseModel):
    token: str | None = None
    error: LlmProxyKeyError | None = None


def make_llm_proxy_key(
    *,
    org_id: int,
    project_id: int | None = None,
    feature: str,
) -> MakeLlmProxyKeyResponse:
    """Generate a short-lived HS256 JWT for authenticating to the LLM proxy.

    Signed with SEER_API_SHARED_SECRET. The proxy verifies locally
    using the same secret, so no per-request RPC callback is needed.
    """
    try:
        proxy_feature = LlmProxyFeature(feature)
    except ValueError:
        return MakeLlmProxyKeyResponse(error=LlmProxyKeyError.UNKNOWN_FEATURE)

    extra_flags = FEATURE_FLAGS[proxy_feature]

    secret = settings.SEER_API_SHARED_SECRET
    if not secret:
        return MakeLlmProxyKeyResponse(error=LlmProxyKeyError.SIGNING_SECRET_NOT_CONFIGURED)

    try:
        organization = Organization.objects.get(id=org_id, status=OrganizationStatus.ACTIVE)
    except Organization.DoesNotExist:
        return MakeLlmProxyKeyResponse(error=LlmProxyKeyError.ORGANIZATION_NOT_FOUND)

    if not has_seer_access(organization):
        return MakeLlmProxyKeyResponse(error=LlmProxyKeyError.FEATURE_NOT_ENABLED)

    if extra_flags:
        batch_result = features.batch_has(extra_flags, organization=organization)
        if batch_result:
            org_results = batch_result.get(f"organization:{organization.id}", {})
            if not all(org_results.get(flag) for flag in extra_flags):
                return MakeLlmProxyKeyResponse(error=LlmProxyKeyError.FEATURE_NOT_ENABLED)
        else:
            return MakeLlmProxyKeyResponse(error=LlmProxyKeyError.FEATURE_NOT_ENABLED)

    if project_id is not None:
        if not Project.objects.filter(id=project_id, organization=organization).exists():
            return MakeLlmProxyKeyResponse(error=LlmProxyKeyError.PROJECT_NOT_FOUND)

    now = time.time()
    payload = {
        "organization_id": org_id,
        "feature": feature,
        "iat": now,
        "exp": now + LLM_PROXY_JWT_TTL,
        "iss": "sentry",
    }
    if project_id is not None:
        payload["project_id"] = project_id

    token = pyjwt.encode(payload, secret, algorithm="HS256", headers={"kid": _key_id(secret)})
    return MakeLlmProxyKeyResponse(token=token)


_SERVER_ERRORS = frozenset({LlmProxyKeyError.SIGNING_SECRET_NOT_CONFIGURED})


class LlmProxyKeyTokenResponse(TypedDict):
    token: str


class LlmProxyKeyErrorResponse(TypedDict):
    detail: str


@internal_cell_silo_endpoint
class InternalLlmProxyKeyEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    authentication_classes = (SeerRpcViewerContextAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    @extend_schema(
        operation_id="mintLlmProxyKey",
        request=inline_serializer(
            "LlmProxyKeyRequest",
            fields={
                "org_id": serializers.IntegerField(help_text="Organization ID"),
                "project_id": serializers.IntegerField(
                    required=False, help_text="Project ID (optional)"
                ),
                "feature": serializers.CharField(help_text="Seer feature name"),
            },
        ),
        responses={
            200: LlmProxyKeyTokenResponse,
            400: LlmProxyKeyErrorResponse,
            403: None,
            500: LlmProxyKeyErrorResponse,
        },
    )
    def post(self, request: Request) -> Response:
        if not request.auth or not isinstance(
            request.successful_authenticator, SeerRpcViewerContextAuthentication
        ):
            raise PermissionDenied

        vc = getattr(request, "_seer_rpc_viewer_context", None)

        org_id = request.data.get("org_id")
        project_id = request.data.get("project_id")
        feature = request.data.get("feature")

        if not org_id or not feature:
            return Response({"detail": "org_id and feature are required"}, status=400)

        try:
            org_id = int(org_id)
        except (TypeError, ValueError):
            return Response({"detail": "org_id must be an integer"}, status=400)

        if vc is not None and (vc.organization_id is None or org_id != int(vc.organization_id)):
            raise PermissionDenied

        if project_id is not None:
            try:
                project_id = int(project_id)
            except (TypeError, ValueError):
                return Response({"detail": "project_id must be an integer"}, status=400)

        result = make_llm_proxy_key(
            org_id=org_id,
            project_id=project_id,
            feature=feature,
        )

        if result.error:
            status = 500 if result.error in _SERVER_ERRORS else 400
            return Response({"detail": result.error}, status=status)

        return Response({"token": result.token})

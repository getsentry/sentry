import hashlib
import logging
import time

import jwt as pyjwt
from django.conf import settings
from pydantic import BaseModel
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

logger = logging.getLogger(__name__)

LLM_PROXY_JWT_TTL = 3600

FEATURE_FLAGS: dict[str, list[str]] = {
    "anomaly_detection": [],
    "assisted_query": [],
    "autofix": [],
    "code_review": ["organizations:code-review-beta"],
    "explorer": ["organizations:seer-explorer"],
    "grouping": [],
    "issue_detection": ["organizations:ai-issue-detection"],
    "malicious_issue_detection": [],
    "pr_metrics": [],
    "severity": [],
    "summarization": [],
    "workflows": [],
}


def _key_id(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:8]


class MakeLlmProxyKeyResponse(BaseModel):
    token: str | None = None
    error: str | None = None


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
    secret = settings.SEER_API_SHARED_SECRET
    if not secret:
        return MakeLlmProxyKeyResponse(error="signing_secret_not_configured")

    try:
        organization = Organization.objects.get(id=org_id, status=OrganizationStatus.ACTIVE)
    except Organization.DoesNotExist:
        return MakeLlmProxyKeyResponse(error="organization_not_found")

    extra_flags = FEATURE_FLAGS.get(feature)
    if extra_flags is None:
        return MakeLlmProxyKeyResponse(error="unknown_feature")

    if not has_seer_access(organization):
        return MakeLlmProxyKeyResponse(error="feature_not_enabled")

    for flag in extra_flags:
        if not features.has(flag, organization):
            return MakeLlmProxyKeyResponse(error="feature_not_enabled")

    if project_id is not None:
        if not Project.objects.filter(id=project_id, organization=organization).exists():
            return MakeLlmProxyKeyResponse(error="project_not_found")

    now = time.time()
    payload = {
        "org_id": org_id,
        "feature": feature,
        "iat": now,
        "exp": now + LLM_PROXY_JWT_TTL,
        "iss": "sentry",
    }
    if project_id is not None:
        payload["project_id"] = project_id

    token = pyjwt.encode(payload, secret, algorithm="HS256", headers={"kid": _key_id(secret)})
    return MakeLlmProxyKeyResponse(token=token)


@internal_cell_silo_endpoint
class InternalLlmProxyKeyEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    authentication_classes = (SeerRpcViewerContextAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    def post(self, request: Request) -> Response:
        if not request.auth or not isinstance(
            request.successful_authenticator, SeerRpcViewerContextAuthentication
        ):
            raise PermissionDenied

        org_id = request.data.get("org_id")
        project_id = request.data.get("project_id")
        feature = request.data.get("feature")

        if not org_id or not feature:
            return Response({"detail": "org_id and feature are required"}, status=400)

        try:
            org_id = int(org_id)
        except (TypeError, ValueError):
            return Response({"detail": "org_id must be an integer"}, status=400)

        result = make_llm_proxy_key(
            org_id=org_id,
            project_id=project_id,
            feature=feature,
        )

        if result.error:
            return Response({"detail": result.error}, status=400)

        return Response({"token": result.token})

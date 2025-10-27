import hashlib
import hmac
import logging
from typing import Any

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed, ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.constants import (
    ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
    HIDE_AI_FEATURES_DEFAULT,
    ObjectStatus,
)
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.prevent.types.config import PREVENT_AI_CONFIG_GITHUB_DEFAULT
from sentry.silo.base import SiloMode

logger = logging.getLogger(__name__)


def _signature_input_from_request(request: Request) -> bytes:
    """Build message to sign: raw request body bytes."""
    body_bytes = request.body if request.body not in (None, b"") else b"[]"
    return body_bytes


def compare_signature(request: Request, signature: str) -> bool:
    """Validate HMAC signature using OVERWATCH_RPC_SHARED_SECRET.

    - Header format: `Authorization: Rpcsignature rpc0:<hex>`
    - Input: raw body bytes
    - Secret exists in settings.OVERWATCH_RPC_SHARED_SECRET
    """
    if not settings.OVERWATCH_RPC_SHARED_SECRET:
        raise AuthenticationFailed("Missing OVERWATCH shared secret")

    if not signature.startswith("rpc0:"):
        raise AuthenticationFailed("Invalid signature prefix: expected 'rpc0:'")

    try:
        _, signature_data = signature.split(":", 1)
    except ValueError:
        raise AuthenticationFailed("Invalid Authorization format. Expected 'rpc0:<hex>'")

    message = _signature_input_from_request(request)
    for secret in settings.OVERWATCH_RPC_SHARED_SECRET:
        computed = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
        if hmac.compare_digest(computed, signature_data):
            return True

    body_len = len(message)
    sig_len = len(signature_data)

    raise AuthenticationFailed(f"Signature mismatch. body_len={body_len} sig_len={sig_len}")


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class OverwatchRpcSignatureAuthentication(StandardAuthentication):
    """Authentication for Overwatch-style HMAC signed requests."""

    token_name = b"rpcsignature"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        compare_signature(request, token)

        sentry_sdk.get_isolation_scope().set_tag("overwatch_rpc_auth", True)

        return (AnonymousUser(), token)


def _can_use_prevent_ai_features(org: Organization) -> bool:
    """Check if organization has opted in to Prevent AI features."""
    hide_ai_features = org.get_option("sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT)
    pr_review_test_generation_enabled = bool(
        org.get_option(
            "sentry:enable_pr_review_test_generation",
            ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
        )
    )
    return not hide_ai_features and pr_review_test_generation_enabled


@region_silo_endpoint
class PreventPrReviewResolvedConfigsEndpoint(Endpoint):
    """
    Returns the resolved config for a Sentry organization.

    GET /prevent/pr-review/configs/resolved?sentryOrgId={orgId}
    """

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CODECOV
    authentication_classes = (OverwatchRpcSignatureAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    def get(self, request: Request) -> Response:
        if not request.auth or not isinstance(
            request.successful_authenticator, OverwatchRpcSignatureAuthentication
        ):
            raise PermissionDenied
        sentry_org_id = request.GET.get("sentryOrgId")
        if not sentry_org_id:
            raise ParseError("Missing required query parameter: sentryOrgId")

        try:
            organization = Organization.objects.get(id=sentry_org_id)
        except Organization.DoesNotExist:
            raise ParseError(f"Organization with ID {sentry_org_id} not found")
        except ValueError:
            raise ParseError(f"Invalid organization ID: {sentry_org_id}")

        prevent_ai_config = organization.get_option(
            "sentry:prevent_ai_config_github", PREVENT_AI_CONFIG_GITHUB_DEFAULT
        )

        return Response(data=prevent_ai_config)


@region_silo_endpoint
class PreventPrReviewSentryOrgEndpoint(Endpoint):
    """
    Get Sentry organization IDs for a GitHub repository.

    GET /prevent/pr-review/github/sentry-org?repoId={repoId}
    """

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CODECOV
    authentication_classes = (OverwatchRpcSignatureAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    def get(self, request: Request) -> Response:
        if not request.auth or not isinstance(
            request.successful_authenticator, OverwatchRpcSignatureAuthentication
        ):
            raise PermissionDenied

        repo_id = request.GET.get("repoId")

        if not repo_id:
            raise ParseError("Missing required query parameter: repoId")

        organization_ids = Repository.objects.filter(
            external_id=repo_id,
            provider="integrations:github",
            status=ObjectStatus.ACTIVE,
        ).values_list("organization_id", flat=True)

        organizations = Organization.objects.filter(id__in=organization_ids)

        # Return all orgs with their consent status for AI features
        return Response(
            data={
                "organizations": [
                    {
                        "org_id": org.id,
                        "org_slug": org.slug,
                        "org_name": org.name,
                        "has_consent": _can_use_prevent_ai_features(org),
                    }
                    for org in organizations
                ]
            }
        )

import hashlib
import hmac
import logging
from copy import deepcopy
from typing import Any

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed, ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.constants import DEFAULT_CODE_REVIEW_TRIGGERS, ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings
from sentry.prevent.models import PreventAIConfiguration
from sentry.prevent.types.config import PREVENT_AI_CONFIG_DEFAULT, PREVENT_AI_CONFIG_DEFAULT_V1
from sentry.seer.code_review.billing import passes_code_review_billing_check
from sentry.silo.base import SiloMode
from sentry.utils.seer import can_use_prevent_ai_features

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


@region_silo_endpoint
class PreventPrReviewResolvedConfigsEndpoint(Endpoint):
    """
    Returns the resolved config for a Sentry organization.

    GET /prevent/pr-review/configs/resolved?sentryOrgId={orgId}&gitOrgName={gitOrgName}&provider={provider}
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

        sentry_org_id_str = request.GET.get("sentryOrgId")
        if not sentry_org_id_str:
            raise ParseError("Missing required query parameter: sentryOrgId")
        try:
            sentry_org_id = int(sentry_org_id_str)
            if sentry_org_id <= 0:
                raise ParseError("sentryOrgId must be a positive integer")
        except ValueError:
            raise ParseError("sentryOrgId must be a valid integer")

        git_org_name = request.GET.get("gitOrgName")
        if not git_org_name:
            raise ParseError("Missing required query parameter: gitOrgName")
        provider = request.GET.get("provider")
        if not provider:
            raise ParseError("Missing required query parameter: provider")

        github_org_integrations = integration_service.get_organization_integrations(
            organization_id=sentry_org_id,
            providers=[provider],
            status=ObjectStatus.ACTIVE,
            name=git_org_name,
        )
        if not github_org_integrations:
            return Response({"detail": "GitHub integration not found"}, status=404)

        config = PreventAIConfiguration.objects.filter(
            organization_id=sentry_org_id,
            integration_id=github_org_integrations[0].integration_id,
        ).first()

        organization = Organization.objects.filter(id=sentry_org_id).first()

        default_config = PREVENT_AI_CONFIG_DEFAULT
        if features.has("organizations:code-review-run-per-commit", organization):
            default_config = PREVENT_AI_CONFIG_DEFAULT_V1

        response_data: dict[str, Any] = deepcopy(default_config)
        if config:
            response_data["organization"] = config.data

        return Response(data=response_data)


@region_silo_endpoint
class CodeReviewRepoSettingsEndpoint(Endpoint):
    """
    Returns the code review repository settings for a specific repo within a Sentry organization.

    GET /code-review/repo-settings?sentryOrgId={orgId}&externalRepoId={externalRepoId}&provider={provider}
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

        sentry_org_id_str = request.GET.get("sentryOrgId")
        if not sentry_org_id_str:
            raise ParseError("Missing required query parameter: sentryOrgId")
        try:
            sentry_org_id = int(sentry_org_id_str)
            if sentry_org_id <= 0:
                raise ParseError("sentryOrgId must be a positive integer")
        except ValueError:
            raise ParseError("sentryOrgId must be a valid integer")

        external_repo_id = request.GET.get("externalRepoId")
        if not external_repo_id:
            raise ParseError("Missing required query parameter: externalRepoId")

        provider = request.GET.get("provider")
        if not provider:
            raise ParseError("Missing required query parameter: provider")

        repo_settings = (
            RepositorySettings.objects.select_related("repository")
            .filter(
                repository__external_id=external_repo_id,
                repository__organization_id=sentry_org_id,
                repository__provider=provider,
                repository__status=ObjectStatus.ACTIVE,
            )
            .first()
        )

        if repo_settings is None:
            organization = Organization.objects.filter(id=sentry_org_id).first()
            if organization and (
                features.has("organizations:code-review-beta", organization)
                or bool(
                    organization.get_option(
                        "sentry:enable_pr_review_test_generation",
                        False,
                    )
                )
            ):
                return Response(
                    {"enabledCodeReview": True, "codeReviewTriggers": DEFAULT_CODE_REVIEW_TRIGGERS}
                )

            return Response(
                {
                    "enabledCodeReview": False,
                    "codeReviewTriggers": [],
                }
            )

        return Response(
            {
                "enabledCodeReview": repo_settings.enabled_code_review,
                "codeReviewTriggers": repo_settings.code_review_triggers,
            }
        )


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
                        "has_consent": can_use_prevent_ai_features(org),
                    }
                    for org in organizations
                ]
            }
        )


def _is_eligible_for_code_review(
    organization: Organization, repository_id: int, integration_id: int, external_identifier: str
) -> bool:
    """
    Check if a PR author is eligible for Overwatch code review forwarding.

    Returns True if:
    1. Organization IS in code-review-beta cohort (always forward), OR
    2. Repository has code review explicitly enabled AND contributor has a seat
    """
    if features.has("organizations:code-review-beta", organization):
        return True

    # Check if code review is enabled for this repository
    code_review_enabled = RepositorySettings.objects.filter(
        repository_id=repository_id,
        enabled_code_review=True,
    ).exists()

    if not code_review_enabled:
        return False

    return passes_code_review_billing_check(
        organization_id=organization.id,
        integration_id=integration_id,
        external_identifier=external_identifier,
    )


@region_silo_endpoint
class PreventPrReviewEligibilityEndpoint(Endpoint):
    """
    Check if a PR author is eligible for Overwatch code review forwarding.

    GET /prevent/pr-review/eligibility?repoId={repoId}&prAuthorId={prAuthorId}

    Returns true if the PR author is eligible for code review in any organization.
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
        pr_author_id = request.GET.get("prAuthorId")

        if not repo_id:
            raise ParseError("Missing required query parameter: repoId")
        if not pr_author_id:
            raise ParseError("Missing required query parameter: prAuthorId")

        repositories = Repository.objects.filter(
            external_id=repo_id,
            provider="integrations:github",
            status=ObjectStatus.ACTIVE,
        )

        if not repositories.exists():
            return Response(data={"is_eligible": False})

        org_ids = repositories.values_list("organization_id", flat=True)
        organizations = {org.id: org for org in Organization.objects.filter(id__in=org_ids)}

        # Just need a single org to be eligible
        for repo in repositories:
            org = organizations.get(repo.organization_id)
            if not org or repo.integration_id is None:
                continue

            if _is_eligible_for_code_review(
                organization=org,
                repository_id=repo.id,
                integration_id=repo.integration_id,
                external_identifier=pr_author_id,
            ):
                return Response(data={"is_eligible": True})

        return Response(data={"is_eligible": False})

from __future__ import annotations

from typing import Final

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.repository import REPOSITORY_NAME_LENGTH
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.agent.tools import get_repository_definition
from sentry.seer.scm_connect import NO_SCM_INTEGRATION
from sentry.seer.seer_setup import get_supported_scm_providers
from sentry.seer.sentry_data_models import RepositoryDefinitionFailure
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.auth import is_user_from_viewer_context

# Asked without a repository: source control is connected, but Sentry is still getting its
# repositories, so a list of them would come back empty or short.
REPOS_SYNCING: Final = "repos_syncing"


class RepoAccessQuerySerializer(serializers.Serializer):
    # A name longer than Repository.name can hold can't match a repository. Without one, the check
    # is whether any source control is connected: the popup for an empty repository list.
    repoName = serializers.CharField(
        max_length=REPOSITORY_NAME_LENGTH, trim_whitespace=True, required=False
    )


@cell_silo_endpoint
class OrganizationSeerRepoAccessEndpoint(OrganizationEndpoint):
    """Whether Seer can open a repository now, and why not when it can't.

    Serves the popup shown while a Seer chat waits on a repository it couldn't open. The popup
    polls this until the user's fix (connecting source control, granting the repo to the app)
    reaches Sentry. It runs the lookup Seer's tools use, so the popup and Seer agree.

    Browser sessions only: API tokens and Seer's ``X-Viewer-Context`` are refused.
    """

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    # Any member: what this returns, members can already read from the repos and integrations
    # endpoints. Every read is scoped to the organization.
    permission_classes = (OrganizationPermission,)
    # The popup polls every few seconds while it's open.
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=120, window=60, concurrent_limit=10),
                RateLimitCategory.USER: RateLimit(limit=60, window=60, concurrent_limit=5),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=600, window=60, concurrent_limit=50
                ),
            }
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Returns ``{"status": ..., "connectedAccounts": [...]}``. ``status`` is ``found`` when
        Seer can open the repository, a failure reason (``no_scm_integration``,
        ``scm_account_not_connected``, ``repo_not_in_sentry`` or ``repo_ambiguous``) when it
        can't, or ``unknown`` when the lookup misses for a reason Sentry can't name.

        Without ``repoName``, ``status`` is ``found`` once source control Seer can use is
        connected and Sentry has its repositories, ``repos_syncing`` while Sentry is still getting
        them, and ``no_scm_integration`` when none is connected.
        """
        # The auth middleware signs in a viewer-context user before authentication runs, so the
        # call would pass as a browser session. Refuse it: only the UI checks this.
        if is_user_from_viewer_context(request):
            raise PermissionDenied("Repository access can only be checked from a user session.")
        if not features.has(
            "organizations:ask-seer-scm-connect-prompt", organization, actor=request.user
        ):
            raise ResourceDoesNotExist
        # The popup only shows in a Seer chat, so the check needs the same access as the chat.
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)
        if not has_access:
            raise PermissionDenied(error)

        serializer = RepoAccessQuerySerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        repo_name = serializer.validated_data.get("repoName")
        if repo_name is None:
            # On `found`, the popup has Seer list the repositories again. Right after an install
            # that list would be empty, since the install only starts getting them, so `found`
            # waits for that.
            sync = integration_service.get_scm_repo_sync_state(
                organization_id=organization.id,
                providers=get_supported_scm_providers(organization),
            )
            if not sync.has_integration:
                status = NO_SCM_INTEGRATION
            elif sync.syncing:
                status = REPOS_SYNCING
            else:
                status = "found"
            return Response({"status": status, "connectedAccounts": []})

        result = get_repository_definition(
            organization_id=organization.id,
            repo_full_name=repo_name,
            report_failure_reason=True,
        )
        # Only the outcome is returned: the popup doesn't need the repository's details.
        if isinstance(result, RepositoryDefinitionFailure):
            return Response(
                {
                    "status": result.failure_reason,
                    "connectedAccounts": result.connected_accounts,
                }
            )
        return Response(
            {"status": "unknown" if result is None else "found", "connectedAccounts": []}
        )

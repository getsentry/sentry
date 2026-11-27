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
from sentry.seer.agent.tools import get_repo_account_integration_ids, get_repository_definition
from sentry.seer.scm_connect import NO_SCM_INTEGRATION
from sentry.seer.seer_setup import get_supported_scm_providers
from sentry.seer.sentry_data_models import RepositoryDefinitionFailure, RepositoryDefinitionResponse
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
    integrationId = serializers.IntegerField(min_value=1, max_value=2**63 - 1, required=False)


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

        A found repo takes precedence over any sync. On a miss, an active sync for the repo’s
        account returns ``repos_syncing``. An optional ``integrationId`` narrows which syncs
        matter, without narrowing the repo lookup. ``syncFailure`` is present if a relevant
        sync failed.

        Without ``repoName``, ``found`` means Seer can retry listing repositories, not that the
        list is nonempty. A failed sync does not block listing the repos Sentry already has.
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
        integration_id = serializer.validated_data.get("integrationId")
        sync_ids = [integration_id] if integration_id is not None else None
        providers = get_supported_scm_providers(organization)

        if repo_name is None:
            # On `found`, the popup has Seer list the repositories again. Right after an install
            # that list would be empty, since the install only starts getting them, so `found`
            # waits for that.
            sync = integration_service.get_scm_repo_sync_state(
                organization_id=organization.id,
                providers=providers,
                sync_integration_ids=sync_ids,
            )
            if not sync.has_integration:
                status = NO_SCM_INTEGRATION
            elif sync.syncing:
                status = REPOS_SYNCING
            else:
                status = "found"
            return _repo_access_response(status, [], sync_failure=sync.failure_reason)

        result = get_repository_definition(
            organization_id=organization.id,
            repo_full_name=repo_name,
            report_failure_reason=True,
        )
        if isinstance(result, RepositoryDefinitionResponse):
            return _repo_access_response("found", [])

        status = "unknown"
        connected_accounts: list[str] = []
        if isinstance(result, RepositoryDefinitionFailure):
            status = result.failure_reason
            connected_accounts = result.connected_accounts

        # Ambiguity, a missing integration and a disconnected account are not import delays.
        if status not in {"repo_not_in_sentry", "unknown"}:
            return _repo_access_response(status, connected_accounts)

        matching_ids = get_repo_account_integration_ids(organization.id, repo_name, providers)
        if integration_id is not None:
            matching_ids = [candidate for candidate in matching_ids if candidate == integration_id]
        if not matching_ids:
            return _repo_access_response(status, connected_accounts)

        sync = integration_service.get_scm_repo_sync_state(
            organization_id=organization.id, providers=providers, sync_integration_ids=matching_ids
        )
        if sync.syncing:
            return _repo_access_response(REPOS_SYNCING, connected_accounts)
        return _repo_access_response(status, connected_accounts, sync_failure=sync.failure_reason)


def _repo_access_response(
    status: str, connected_accounts: list[str], *, sync_failure: str | None = None
) -> Response:
    return Response(
        {
            "status": status,
            "connectedAccounts": connected_accounts,
            **({"syncFailure": sync_failure} if sync_failure is not None else {}),
        }
    )

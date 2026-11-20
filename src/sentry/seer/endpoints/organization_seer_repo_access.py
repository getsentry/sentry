from __future__ import annotations

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
from sentry.models.organization import Organization
from sentry.models.repository import REPOSITORY_NAME_LENGTH
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.agent.tools import get_repository_definition
from sentry.seer.sentry_data_models import RepositoryDefinitionFailure
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.auth import is_user_from_viewer_context


class RepoAccessQuerySerializer(serializers.Serializer):
    # A name longer than Repository.name can hold can't match a repository.
    repoName = serializers.CharField(max_length=REPOSITORY_NAME_LENGTH, trim_whitespace=True)


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

        result = get_repository_definition(
            organization_id=organization.id,
            repo_full_name=serializer.validated_data["repoName"],
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

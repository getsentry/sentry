import logging
from typing import Any

from django.core.exceptions import PermissionDenied

from sentry import http, options
from sentry.identity.oauth2 import OAuth2Provider
from sentry.integrations.types import IntegrationProviderSlug

logger = logging.getLogger(__name__)


def get_user_info(access_token):
    from sentry.integrations.github.constants import GITHUB_API_ACCEPT_HEADER

    with http.build_session() as session:
        resp = session.get(
            "https://api.github.com/user",
            headers={"Accept": GITHUB_API_ACCEPT_HEADER, "Authorization": f"token {access_token}"},
        )
        resp.raise_for_status()
    return resp.json()


# GitHub has 2 types of apps -- GitHub apps and OAuth apps. SSO is implemented
# using OAuth App, but signup and integrations use the github app. When github
# apps have API parity with OAuth apps, we should move SSO to it as well.
# https://developer.github.com/apps/differences-between-apps/


class GitHubIdentityProvider(OAuth2Provider):
    key = IntegrationProviderSlug.GITHUB.value
    name = "GitHub"

    oauth_access_token_url = "https://github.com/login/oauth/access_token"
    oauth_authorize_url = "https://github.com/login/oauth/authorize"

    oauth_scopes = ()

    def get_oauth_client_id(self):
        return options.get("github-app.client-id")

    def get_oauth_client_secret(self):
        return options.get("github-app.client-secret")

    def build_identity(self, data):
        data = data["data"]
        access_token = data.get("access_token")
        if not access_token:
            raise PermissionDenied()
        user = get_user_info(access_token)

        return {
            "type": "github",
            "id": user["id"],
            "email": user["email"],
            "email_verified": bool(user["email"]),
            "login": user["login"],
            "name": user["name"],
            "company": user["company"],
            "scopes": [],  # GitHub apps do not have user scopes
            "data": self.get_oauth_data(data),
        }

    def post_link_identity(self, identity: dict[str, Any], user_id: int) -> None:
        # A linked GitHub identity is an authoritative user<->GitHub mapping, so mirror
        # it into ExternalActor for the user's GitHub-integrated orgs. Best-effort.
        #
        # This is github.com only by design: GitHub Enterprise has no social-login flow
        # (GitHubEnterpriseIdentityProvider.build_identity raises). The only enterprise
        # identity that ever exists is the installer's (linked at integration-install
        # time), which isn't worth mapping, so we skip enterprise here entirely.
        github_id = identity.get("id")
        ensure_external_actors_for_github_identity(
            user_id=user_id,
            github_login=identity.get("login"),
            github_id=str(github_id) if github_id is not None else None,
        )


def ensure_external_actors_for_github_identity(
    *,
    user_id: int,
    github_login: str | None,
    github_id: str | None,
) -> None:
    """
    Reactively create GitHub ``ExternalActor`` mappings for a user who just linked their
    github.com identity to Sentry (the social-auth login flow).

    A linked GitHub identity is an authoritative user<->GitHub mapping, so we mirror it
    into ``ExternalActor`` for every organization the user belongs to that has an active
    GitHub integration. Discovery happens entirely in the control silo
    (``OrganizationMemberMapping``/``OrganizationIntegration``/``Integration`` are all
    control models); only the row write crosses into the org's cell, via a single
    cell-resolved RPC per org.

    This is best-effort: it must never raise into the linking flow, and the periodic
    backfill remains the safety net for anything missed here.
    """
    from sentry.constants import ObjectStatus
    from sentry.integrations.models.organization_integration import OrganizationIntegration
    from sentry.integrations.types import ExternalActorSource, ExternalProviders
    from sentry.models.organizationmembermapping import OrganizationMemberMapping
    from sentry.organizations.services.organization import organization_service

    if not github_login:
        return

    try:
        org_ids = list(
            OrganizationMemberMapping.objects.filter(user_id=user_id).values_list(
                "organization_id", flat=True
            )
        )
        if not org_ids:
            return

        org_integrations = OrganizationIntegration.objects.filter(
            organization_id__in=org_ids,
            status=ObjectStatus.ACTIVE,
            integration__provider=IntegrationProviderSlug.GITHUB.value,
            integration__status=ObjectStatus.ACTIVE,
        ).values_list("organization_id", "integration_id")
    except Exception:
        logger.exception(
            "github.identity.external_actor.discovery_failed",
            extra={"user_id": user_id},
        )
        return

    external_name = f"@{github_login.lstrip('@')}"
    for organization_id, integration_id in org_integrations:
        try:
            organization_service.upsert_external_actor(
                organization_id=organization_id,
                integration_id=integration_id,
                user_id=user_id,
                provider=ExternalProviders.GITHUB.value,
                external_name=external_name,
                external_id=github_id,
                source=ExternalActorSource.IDENTITY.value,
            )
        except Exception:
            logger.exception(
                "github.identity.external_actor.create_failed",
                extra={
                    "user_id": user_id,
                    "organization_id": organization_id,
                    "integration_id": integration_id,
                },
            )

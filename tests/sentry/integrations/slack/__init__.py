from typing import Optional

from sentry.integrations.slack.message_builder import SlackBody
from sentry.models import (
    ExternalActor,
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    Organization,
    OrganizationIntegration,
    Team,
    User,
)
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


def get_response_text(data: SlackBody) -> str:
    return (
        # If it's an attachment.
        data.get("text")
        or
        # If it's blocks.
        "\n".join(block["text"]["text"] for block in data["blocks"] if block["type"] == "section")
    )


def install_slack(organization: Organization, workspace_id: str = "TXXXXXXX1") -> Integration:
    integration = Integration.objects.create(
        external_id=workspace_id,
        metadata={
            "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "domain_name": "sentry.slack.com",
            "installation_type": "born_as_bot",
        },
        name="Awesome Team",
        provider="slack",
    )
    OrganizationIntegration.objects.create(organization=organization, integration=integration)
    return integration


def add_identity(
    integration: Integration, user: User, external_id: str = "UXXXXXXX1"
) -> IdentityProvider:
    idp = IdentityProvider.objects.create(
        type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
        external_id=integration.external_id,
        config={},
    )
    Identity.objects.create(
        user=user, idp=idp, external_id=external_id, status=IdentityStatus.VALID
    )
    return idp


def find_identity(idp: IdentityProvider, user: User) -> Optional[Identity]:
    identities = Identity.objects.filter(
        idp=idp,
        user=user,
        status=IdentityStatus.VALID,
    )
    if not identities:
        return None
    return identities[0]


def link_user(user: User, idp: IdentityProvider, slack_id: str) -> None:
    Identity.objects.create(
        external_id=slack_id,
        idp=idp,
        user=user,
        status=IdentityStatus.VALID,
        scopes=[],
    )


def link_team(team: Team, integration: Integration, channel_name: str, channel_id: str) -> None:
    ExternalActor.objects.create(
        actor_id=team.actor_id,
        organization=team.organization,
        integration=integration,
        provider=ExternalProviders.SLACK.value,
        external_name=channel_name,
        external_id=channel_id,
    )

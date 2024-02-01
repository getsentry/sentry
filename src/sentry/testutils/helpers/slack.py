from typing import Optional
from urllib.parse import parse_qs

import responses

from sentry.integrations.slack.message_builder import SlackBody
from sentry.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.models.user import User
from sentry.silo import SiloMode
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json


def get_response_text(data: SlackBody) -> str:
    return (
        # If it's an attachment.
        data.get("text")
        or
        # If it's blocks.
        "\n".join(block["text"]["text"] for block in data["blocks"] if block["type"] == "section")
    )


@assume_test_silo_mode(SiloMode.CONTROL)
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
    OrganizationIntegration.objects.create(organization_id=organization.id, integration=integration)
    return integration


@assume_test_silo_mode(SiloMode.CONTROL)
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


@assume_test_silo_mode(SiloMode.CONTROL)
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
        team_id=team.id,
        organization=team.organization,
        integration_id=integration.id,
        provider=ExternalProviders.SLACK.value,
        external_name=channel_name,
        external_id=channel_id,
    )


def get_channel(index=0):
    """Get the channel ID the Slack message went to"""
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[index].request.body)
    assert "channel" in data
    channel = json.loads(data["channel"][0])

    return channel


def get_attachment(index=0):
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[index].request.body)
    assert "text" in data
    assert "attachments" in data
    attachments = json.loads(data["attachments"][0])

    assert len(attachments) == 1
    return attachments[0], data["text"][0]


def get_attachment_no_text():
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[0].request.body)
    assert "attachments" in data
    attachments = json.loads(data["attachments"][0])
    assert len(attachments) == 1
    return attachments[0]


def get_blocks_and_fallback_text(index=0):
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[index].request.body)
    assert "blocks" in data
    assert "text" in data
    blocks = json.loads(data["blocks"][0])
    fallback_text = data["text"][0]
    return blocks, fallback_text


def setup_slack_with_identities(organization, user):
    integration = install_slack(organization)
    idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
    Identity.objects.create(
        external_id="UXXXXXXX1",
        idp=idp,
        user=user,
        status=IdentityStatus.VALID,
        scopes=[],
    )
    responses.add(
        method=responses.POST,
        url="https://slack.com/api/chat.postMessage",
        body='{"ok": true}',
        status=200,
        content_type="application/json",
    )
    return integration

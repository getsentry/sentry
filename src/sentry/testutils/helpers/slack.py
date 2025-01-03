from urllib.parse import parse_qs, quote

import responses

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.slack.message_builder.types import SlackBody
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.users.models.user import User
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


def get_block_kit_preview_url(index=0) -> str:
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[index].request.body)
    assert "blocks" in data
    assert data["blocks"][0]

    stringified_blocks = data["blocks"][0]
    blocks = json.loads(data["blocks"][0])
    stringified_blocks = json.dumps({"blocks": blocks})

    encoded_blocks = quote(stringified_blocks)
    base_url = "https://app.slack.com/block-kit-builder/#"

    preview_url = f"{base_url}{encoded_blocks}"
    return preview_url


def setup_slack_with_identities(
    organization: Organization,
    user: User,
    identity_provider_external_id="TXXXXXXX1",
    identity_external_id="UXXXXXXX1",
):
    integration = install_slack(
        organization=organization, workspace_id=identity_provider_external_id
    )
    idp = IdentityProvider.objects.create(
        type="slack", external_id=identity_provider_external_id, config={}
    )
    Identity.objects.create(
        external_id=identity_external_id,
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

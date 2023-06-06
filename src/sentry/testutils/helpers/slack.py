from typing import Optional
from urllib.parse import parse_qs

import responses

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.notifications import send_notification_as_slack
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
from sentry.testutils.silo import exempt_from_silo_limits
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


@exempt_from_silo_limits()
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
        integration_id=integration.id,
        provider=ExternalProviders.SLACK.value,
        external_name=channel_name,
        external_id=channel_id,
    )


def send_notification(*args):
    provider, *args_list = args
    if provider == ExternalProviders.SLACK:
        send_notification_as_slack(*args_list, {})


def get_attachment():
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[0].request.body)
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

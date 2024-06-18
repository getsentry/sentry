from dataclasses import dataclass

from sentry.models.identity import IdentityProvider
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.organization import RpcOrganization


@dataclass
class IdentityParams:
    organization: RpcOrganization
    integration: Integration
    idp: IdentityProvider
    slack_id: str
    channel_id: str
    response_url: str | None = None

    def __init__(self, organization, integration, idp, slack_id, channel_id, response_url=None):
        self.organization = organization
        self.integration = integration
        self.idp = idp
        self.slack_id = slack_id
        self.channel_id = channel_id
        self.response_url = response_url


@dataclass
class TeamIdentityParams:
    organization_id: str
    integration_id: str
    channel_id: str
    channel_name: str
    slack_id: str
    response_url: str | None = None

    def __init__(
        self, organization_id, integration_id, channel_id, channel_name, slack_id, response_url=None
    ):
        self.organization_id = organization_id
        self.integration_id = integration_id
        self.channel_id = channel_id
        self.channel_name = channel_name
        self.slack_id = slack_id
        self.response_url = response_url

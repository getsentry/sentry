from dataclasses import dataclass

from sentry.integrations.models.integration import Integration
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models.identity import IdentityProvider


@dataclass(frozen=True)
class IdentityParams:
    organization: RpcOrganization
    integration: Integration
    idp: IdentityProvider
    slack_id: str
    channel_id: str
    response_url: str | None = None


@dataclass(frozen=True)
class TeamLinkRequest:
    integration_id: str
    channel_id: str
    channel_name: str
    slack_id: str
    response_url: str


@dataclass(frozen=True)
class TeamUnlinkRequest(TeamLinkRequest):
    organization_id: str

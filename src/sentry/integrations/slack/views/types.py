from dataclasses import dataclass

from sentry.models.identity import IdentityProvider
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.organization import RpcOrganization


@dataclass(frozen=True)
class IdentityParams:
    organization: RpcOrganization
    integration: Integration
    idp: IdentityProvider
    slack_id: str
    channel_id: str
    response_url: str | None = None


@dataclass(frozen=True)
class TeamIdentityRequest:
    organization_id: str
    integration_id: str
    channel_id: str
    channel_name: str
    slack_id: str
    response_url: str | None = None

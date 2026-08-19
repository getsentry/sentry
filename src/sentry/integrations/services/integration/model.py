# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Any

from pydantic import Field

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc import RpcModel
from sentry.identity.services.identity.model import RpcIdentity, RpcIdentityProvider
from sentry.integrations.base import (
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationProvider,
)
from sentry.users.services.user.model import RpcUser


class RpcIntegration(RpcModel):
    id: int
    provider: str
    external_id: str
    name: str
    metadata: dict[str, Any] = Field(repr=False)
    status: int

    def __hash__(self) -> int:
        return hash(self.id)

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"

    def get_provider(self) -> IntegrationProvider:
        from sentry.integrations.models.utils import get_provider

        return get_provider(instance=self)

    def get_installation(self, organization_id: int, **kwargs: Any) -> IntegrationInstallation:
        from sentry.integrations.models.utils import get_installation

        return get_installation(instance=self, organization_id=organization_id, **kwargs)

    def has_feature(self, feature: IntegrationFeatures) -> bool:
        from sentry.integrations.models.utils import has_feature

        return has_feature(instance=self, feature=feature)


class RpcOrganizationIntegration(RpcModel):
    id: int
    default_auth_id: int | None
    organization_id: int
    integration_id: int
    config: dict[str, Any] = Field(repr=False)
    status: int  # As ObjectStatus
    grace_period_end: datetime | None
    date_added: datetime | None

    def __hash__(self) -> int:
        return hash(self.id)

    def get_status_display(self) -> str:
        for status_id, display in ObjectStatus.as_choices():
            if status_id == self.status:
                return display
        return "disabled"


class RpcIntegrationExternalProject(RpcModel):
    id: int
    organization_integration_id: int
    name: str
    external_id: str
    resolved_status: str
    unresolved_status: str


class RpcGiteaAccessToken(RpcModel):
    """A usable Gitea access token, refreshed if it was close to expiring.

    GitHub's equivalent refresh returns an ``RpcIntegration`` because the token it
    mints is stored on the ``Integration`` row. Gitea's token is a user-scoped OAuth
    token living on ``Identity.data``, which is readable only in control silo and has
    nowhere to ride on an ``RpcIntegration``, so it is returned directly.

    Guaranteed valid for the next few minutes only - Gitea access tokens last about an
    hour and the refresh here is proactive, not continuous. Spend it promptly, and ask
    for a new one rather than holding one across a long-running job.

    ``base_url`` is the instance URL recorded when the integration was installed,
    verbatim. Two things follow. It may carry a sub-path, so callers must build URLs
    from it rather than reassembling one from a hostname. And it is customer-supplied
    and not SSRF-validated: inside Sentry every integration client routes through
    ``SafeSession``/``BlacklistAdapter``, and a caller outside that path (getsentry's
    coding-agent handoff) is responsible for its own address blocking.

    ``expires`` is an absolute Unix timestamp in seconds, not a remaining lifetime.

    ``verify_ssl`` mirrors what the integration was installed with. Self-hosted
    instances behind a private CA are installed with it off, and a caller that hardcodes
    verification would fail against them where Sentry itself succeeds.
    """

    access_token: str
    base_url: str
    expires: int | None = None
    verify_ssl: bool = True


class RpcIntegrationIdentityContext(RpcModel):
    integration: RpcIntegration | None
    identity_provider: RpcIdentityProvider | None
    identity: RpcIdentity | None
    user: RpcUser | None


class RpcOrganizationContext(RpcModel):
    integration: RpcIntegration | None
    organization_integration: RpcOrganizationIntegration | None


class RpcOrganizationContextList(RpcModel):
    integration: RpcIntegration | None
    organization_integrations: list[RpcOrganizationIntegration]

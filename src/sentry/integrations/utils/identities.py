from typing import Iterable, Mapping, Optional, Tuple

from django.http import Http404

from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Organization,
    OrganizationMember,
    User,
)
from sentry.services.hybrid_cloud.identity import RpcIdentityProvider, identity_service
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


def get_identity_or_404(
    provider: ExternalProviders,
    user: User,
    integration_id: int,
    organization_id: Optional[int] = None,
) -> Tuple[Organization, RpcIntegration, RpcIdentityProvider]:
    """For endpoints, short-circuit with a 404 if we cannot find everything we need."""
    if provider not in EXTERNAL_PROVIDERS:
        raise Http404

    integration = integration_service.get_integration(integration_id=integration_id)
    idp = identity_service.get_provider(
        provider_ext_id=integration.external_id, provider_type=EXTERNAL_PROVIDERS[provider]
    )

    qs = OrganizationMember.objects.get_for_integration(
        integration, user, organization_id=organization_id
    )
    organization = qs.first().organization if qs else None
    if organization is None:
        raise Http404
    return organization, integration, idp


def get_identities_by_user(idp: IdentityProvider, users: Iterable[User]) -> Mapping[User, Identity]:
    identity_models = Identity.objects.filter(
        idp=idp,
        user__in=users,
        status=IdentityStatus.VALID,
    )
    return {identity.user: identity for identity in identity_models}

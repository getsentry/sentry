from typing import Iterable, Mapping, Optional, Tuple

from django.http import Http404

from sentry.constants import ObjectStatus
from sentry.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization import RpcOrganization, organization_service
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


@control_silo_function
def get_identity_or_404(
    provider: ExternalProviders,
    user: User,
    integration_id: int,
    organization_id: Optional[int] = None,
) -> Tuple[RpcOrganization, Integration, IdentityProvider]:
    """For endpoints, short-circuit with a 404 if we cannot find everything we need."""
    if provider not in EXTERNAL_PROVIDERS:
        raise Http404

    integration = Integration.objects.filter(id=integration_id).first()
    if integration is None:
        raise Http404

    idp = IdentityProvider.objects.filter(
        external_id=integration.external_id, type=EXTERNAL_PROVIDERS[provider]
    ).first()
    if idp is None:
        raise Http404

    organization_integrations = OrganizationIntegration.objects.filter(
        status=ObjectStatus.ACTIVE,
        integration__status=ObjectStatus.ACTIVE,
        integration_id=integration_id,
    )
    organization_ids = {oi.organization_id for oi in organization_integrations}
    organizations = user_service.get_organizations(user_id=user.id, only_visible=True)
    valid_organization_ids = [o.id for o in organizations if o.id in organization_ids]
    if len(valid_organization_ids) <= 0:
        raise Http404

    selected_organization_id = (
        organization_id if organization_id is not None else valid_organization_ids[0]
    )
    context = organization_service.get_organization_by_id(
        id=selected_organization_id, user_id=user.id
    )

    if context is None:
        raise Http404
    return context.organization, integration, idp


def get_identities_by_user(idp: IdentityProvider, users: Iterable[User]) -> Mapping[User, Identity]:
    identity_models = Identity.objects.filter(
        idp=idp,
        user__in=users,
        status=IdentityStatus.VALID,
    )
    return {identity.user: identity for identity in identity_models}

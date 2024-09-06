import logging
from collections.abc import Iterable, Mapping

from django.http import Http404

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.silo.base import control_silo_function
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service

_logger = logging.getLogger(__name__)


@control_silo_function
def get_identity_or_404(
    provider: ExternalProviders,
    user: User,
    integration_id: int,
    organization_id: int | None = None,
) -> tuple[RpcOrganization, Integration, IdentityProvider]:
    logger_metadata = {
        "integration_provider": provider,
        "integration_id": integration_id,
        "organization_id": organization_id,
        "user_id": user.id,
    }
    """For endpoints, short-circuit with a 404 if we cannot find everything we need."""
    if provider not in EXTERNAL_PROVIDERS:
        _logger.info("provider is not part of supported external providers", extra=logger_metadata)
        raise Http404

    integration = Integration.objects.filter(id=integration_id).first()
    if integration is None:
        _logger.info("failed to find an integration", extra=logger_metadata)
        raise Http404

    idp = IdentityProvider.objects.filter(
        external_id=integration.external_id, type=EXTERNAL_PROVIDERS[provider]
    ).first()
    logger_metadata["external_id"] = integration.external_id
    if idp is None:
        _logger.info("failed to find an identity provider", extra=logger_metadata)
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
        _logger.info(
            "failed to find any valid organization integrations for user", extra=logger_metadata
        )
        raise Http404

    selected_organization_id = (
        organization_id if organization_id is not None else valid_organization_ids[0]
    )
    context = organization_service.get_organization_by_id(
        id=selected_organization_id,
        user_id=user.id,
        include_projects=False,
        include_teams=False,
    )

    logger_metadata["selected_organization_id"] = selected_organization_id
    if context is None:
        _logger.info("failed to get a context", extra=logger_metadata)
        raise Http404
    return context.organization, integration, idp


def get_identities_by_user(idp: IdentityProvider, users: Iterable[User]) -> Mapping[User, Identity]:
    identity_models = Identity.objects.filter(
        idp=idp,
        user__in=users,
        status=IdentityStatus.VALID,
    )
    return {identity.user: identity for identity in identity_models}

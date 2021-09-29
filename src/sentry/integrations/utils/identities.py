from typing import Iterable, Mapping, Optional, Tuple

from django.http import Http404

from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    Organization,
    User,
)
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


def get_identity_or_404(
    provider: ExternalProviders,
    user: User,
    integration_id: int,
    organization_id: Optional[int] = None,
) -> Tuple[Organization, Integration, IdentityProvider]:
    """For endpoints, short-circuit with a 404 if we cannot find everything we need."""
    try:
        integration = Integration.objects.get(id=integration_id)
        idp = IdentityProvider.objects.get(
            external_id=integration.external_id, type=EXTERNAL_PROVIDERS[provider]
        )
        organization_filters = dict(
            member_set__user=user,
            organizationintegration__integration=integration,
        )
        # If provided, ensure organization_id is valid.
        if organization_id:
            organization_filters.update(dict(id=organization_id))
        organization = Organization.objects.filter(**organization_filters)[0]
    except Exception:
        raise Http404
    return organization, integration, idp


def get_identities_by_user(idp: IdentityProvider, users: Iterable[User]) -> Mapping[User, Identity]:
    identity_models = Identity.objects.filter(
        idp=idp,
        user__in=users,
        status=IdentityStatus.VALID,
    )
    return {identity.user: identity for identity in identity_models}

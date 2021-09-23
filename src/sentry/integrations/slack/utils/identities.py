from typing import Iterable, Mapping, Tuple

from django.http import Http404

from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    Organization,
    User,
)


def get_identity(
    user: User, organization_id: int, integration_id: int
) -> Tuple[Organization, Integration, IdentityProvider]:
    try:
        organization = Organization.objects.get(id__in=user.get_orgs(), id=organization_id)
    except Organization.DoesNotExist:
        raise Http404

    try:
        integration = Integration.objects.get(id=integration_id, organizations=organization)
    except Integration.DoesNotExist:
        raise Http404

    try:
        idp = IdentityProvider.objects.get(external_id=integration.external_id, type="slack")
    except IdentityProvider.DoesNotExist:
        raise Http404

    return organization, integration, idp


def get_identities_by_user(idp: IdentityProvider, users: Iterable[User]) -> Mapping[User, Identity]:
    identity_models = Identity.objects.filter(
        idp=idp,
        user__in=users,
        status=IdentityStatus.VALID,
    )
    return {identity.user: identity for identity in identity_models}

from django.conf import settings
from django.utils import timezone

from sentry import features
from sentry.data_secrecy.service.service import data_secrecy_service
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext


def should_allow_superuser_access(
    organization_context: Organization | RpcUserOrganizationContext,
) -> bool:

    # If self hosted installation, superuser access is allowed
    if settings.SENTRY_SELF_HOSTED:
        return True

    organization: Organization | RpcOrganization
    if isinstance(organization_context, RpcUserOrganizationContext):
        organization = organization_context.organization
    else:
        organization = organization_context

    # If organization does not have data-secrecy feature, return True
    if not features.has("organizations:data-secrecy", organization):
        return True

    # If organization's prevent_superuser_access bitflag is False, return True
    if not organization.flags.prevent_superuser_access:
        return True

    ds = data_secrecy_service.get_data_secrecy_waiver(organization_id=organization.id)

    # If no data secrecy waiver exists, data secrecy is active
    if ds is None:
        return False

    # If current time is before the access_end time of the waiver, data secrecy is active
    return timezone.now() <= ds.access_end

from django.conf import settings

from sentry import features
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext


def should_allow_superuser_access(
    organization_context: Organization | RpcUserOrganizationContext,
) -> bool:

    # If self hosted installation, allow superuser access
    if settings.SENTRY_SELF_HOSTED:
        return True

    organization: Organization | RpcOrganization
    if isinstance(organization_context, RpcUserOrganizationContext):
        organization = organization_context.organization
    else:
        organization = organization_context

    # If organization does not have data-secrecy feature, allow superuser access
    if not features.has("organizations:data-secrecy", organization):
        return True

    # If organization's prevent_superuser_access bitflag is False, allow superuser access
    if not organization.flags.prevent_superuser_access:
        return True

    # If organization has data-secrecy feature, but prevent_superuser_access is True, prevent superuser access
    return False

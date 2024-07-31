from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.utils.services import Service


class PreventSuperuserAccessBackend(Service):
    def should_prevent_superuser_access(
        self,
        organization_context: Organization | RpcUserOrganizationContext,
    ) -> bool:
        raise NotImplementedError


class PreventSuperuserAccess(Service):
    def should_prevent_superuser_access(
        self,
        organization_context: Organization | RpcUserOrganizationContext,
    ) -> bool:
        return False

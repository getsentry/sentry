from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.utils.services import Service

"""
This class defines the interface for a backend that determines whether a superuser should be allowed access to an organization.
The backend should implement the `should_allow_superuser_access` method, which takes an organization context and returns a boolean.
This is a SAAS-only feature, so the default implementation should always return True.
getsentry contains buisness logic.
"""


class PreventSuperuserAccessBackend(Service):
    def should_allow_superuser_access(
        self,
        organization_context: Organization | RpcUserOrganizationContext,
    ) -> bool:
        raise NotImplementedError


class PreventSuperuserAccess(PreventSuperuserAccessBackend):
    def should_allow_superuser_access(
        self,
        organization_context: Organization | RpcUserOrganizationContext,
    ) -> bool:
        return True

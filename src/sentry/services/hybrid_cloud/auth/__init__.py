from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import TYPE_CHECKING, List

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.organization import ApiOrganizationMember
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import OrganizationMember


class AuthService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def get_user_auth_state(
        self,
        *,
        user_id: int,
        is_superuser: bool,
        organization_id: int | None,
        org_member: ApiOrganizationMember | OrganizationMember | None,
    ) -> ApiAuthState:
        pass

    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @abc.abstractmethod
    def get_org_ids_with_scim(
        self,
    ) -> List[int]:
        """
        This method returns a list of org ids that have scim enabled
        :return:
        """
        pass


def impl_with_db() -> AuthService:
    from sentry.services.hybrid_cloud.auth.impl import DatabaseBackedAuthService

    return DatabaseBackedAuthService()


auth_service: AuthService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.CONTROL: stubbed(
            impl_with_db, SiloMode.MONOLITH
        ),  # This eventually must become a DatabaseBackedAuthService, but use the new org member mapping table
        SiloMode.REGION: stubbed(
            impl_with_db, SiloMode.MONOLITH
        ),  # this must eventually be purely RPC
    }
)


@dataclass
class ApiAuthState:
    sso_state: ApiMemberSsoState
    permissions: List[str]


@dataclass(eq=True)
class ApiMemberSsoState:
    is_required: bool = False
    is_valid: bool = False

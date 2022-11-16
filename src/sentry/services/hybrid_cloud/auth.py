from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import List

from django.db.models import F

from sentry import roles
from sentry.models import AuthIdentity, AuthProvider, OrganizationMember
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.services.hybrid_cloud.organization import ApiOrganizationMember
from sentry.silo import SiloMode
from sentry.utils.types import Any


@dataclass(eq=True)
class ApiMemberSsoState:
    is_required: bool = False
    is_valid: bool = False


_SSO_BYPASS = ApiMemberSsoState(False, True)
_SSO_NONMEMBER = ApiMemberSsoState(False, False)


@dataclass
class ApiAuthState:
    sso_state: ApiMemberSsoState
    permissions: List[str]


# When OrgMemberMapping table is created for the control silo, org_member_class will use that rather
# than the OrganizationMember type.
def query_sso_state(
    organization_id: int | None,
    is_super_user: bool,
    member: ApiOrganizationMember | OrganizationMember | None,
    org_member_class: Any = OrganizationMember,
) -> ApiMemberSsoState:
    """
    Check whether SSO is required and valid for a given member.
    This should generally be accessed from the `request.access` object.
    :param member:
    :param org_member_class:
    :return:
    """
    if organization_id is None:
        return _SSO_NONMEMBER

    # we special case superuser so that if they're a member of the org they must still follow SSO checks
    # or put another way, superusers who are not members of orgs bypass SSO.
    if member is None:
        if is_super_user:
            return _SSO_BYPASS
        return _SSO_NONMEMBER

    try:
        auth_provider = AuthProvider.objects.get(organization=member.organization_id)
    except AuthProvider.DoesNotExist:
        return _SSO_BYPASS

    if auth_provider.flags.allow_unlinked:
        return _SSO_BYPASS
    else:
        requires_sso = True
        try:
            auth_identity = AuthIdentity.objects.get(
                auth_provider=auth_provider, user=member.user_id
            )
        except AuthIdentity.DoesNotExist:
            sso_is_valid = False
            # If an owner is trying to gain access,
            # allow bypassing SSO if there are no other
            # owners with SSO enabled.
            if member.role == roles.get_top_dog().id:
                requires_sso = AuthIdentity.objects.filter(
                    auth_provider=auth_provider,
                    user__in=org_member_class.objects.filter(
                        organization_id=member.organization_id,
                        role=roles.get_top_dog().id,
                        user__is_active=True,
                    )
                    .exclude(id=member.id)
                    .values_list("user_id"),
                ).exists()
        else:
            sso_is_valid = auth_identity.is_valid(member)

    return ApiMemberSsoState(is_required=requires_sso, is_valid=sso_is_valid)


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


class DatabaseBackedAuthService(AuthService):
    # Monolith implementation that uses OrganizationMember and User tables freely, but in silo world
    # this won't be possible.
    def get_user_auth_state(
        self,
        *,
        user_id: int,
        is_superuser: bool,
        organization_id: int | None,
        org_member: ApiOrganizationMember | OrganizationMember | None,
    ) -> ApiAuthState:
        from sentry.auth.access import get_permissions_for_user

        sso_state = query_sso_state(
            organization_id=organization_id,
            is_super_user=is_superuser,
            member=org_member,
            org_member_class=OrganizationMember,
        )
        permissions: List[str] = list()
        # "permissions" is a bit of a misnomer -- these are all admin level permissions, and the intent is that if you
        # have them, you can only use them when you are acting, as a superuser.  This is intentional.
        if is_superuser:
            permissions.extend(get_permissions_for_user(user_id))

        return ApiAuthState(
            sso_state=sso_state,
            permissions=permissions,
        )

    def close(self) -> None:
        pass

    def get_org_ids_with_scim(
        self,
    ) -> List[int]:
        return list(
            AuthProvider.objects.filter(
                flags=F("flags").bitor(AuthProvider.flags.scim_enabled)
            ).values_list("organization_id", flat=True)
        )


StubAuthService = CreateStubFromBase(DatabaseBackedAuthService)

auth_service: AuthService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedAuthService(),
        SiloMode.CONTROL: lambda: StubAuthService(),  # This eventually must become a DatabaseBackedAuthService, but use the new org member mapping table
        SiloMode.REGION: lambda: StubAuthService(),  # this must eventually be purely RPC
    }
)

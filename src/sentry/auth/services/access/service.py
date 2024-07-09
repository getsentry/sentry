import abc
from datetime import timedelta

from django.utils import timezone

from sentry.auth import find_providers_requiring_refresh
from sentry.auth.services.auth import (
    RpcAuthIdentity,
    RpcAuthProvider,
    RpcAuthState,
    RpcMemberSsoState,
)
from sentry.hybridcloud.rpc import silo_mode_delegation
from sentry.organizations.services.organization import RpcOrganizationMemberSummary
from sentry.silo.base import SiloMode

_SSO_BYPASS = RpcMemberSsoState(is_required=False, is_valid=True)
_SSO_NONMEMBER = RpcMemberSsoState(is_required=False, is_valid=False)


class AccessService(abc.ABC):
    @abc.abstractmethod
    def get_auth_provider(self, organization_id: int) -> RpcAuthProvider | None:
        pass

    @abc.abstractmethod
    def get_auth_identity_for_user(
        self, auth_provider_id: int, user_id: int
    ) -> RpcAuthIdentity | None:
        pass

    @abc.abstractmethod
    def can_override_sso_as_owner(
        self, auth_provider: RpcAuthProvider, member: RpcOrganizationMemberSummary
    ) -> bool:
        """If an owner is trying to gain access, allow bypassing SSO if there are no
        other owners with SSO enabled.
        """
        pass

    def auth_identity_is_valid(
        self,
        auth_provider: RpcAuthProvider,
        auth_identity: RpcAuthIdentity,
        member: RpcOrganizationMemberSummary,
    ) -> bool:
        if member.flags.sso__invalid:
            return False
        if not member.flags.sso__linked:
            return False

        if not auth_identity.last_verified:
            return False
        if (
            auth_provider.provider in find_providers_requiring_refresh()
        ) and auth_identity.last_verified < timezone.now() - timedelta(hours=24 * 7):
            return False
        return True

    def query_sso_state(
        self,
        *,
        organization_id: int | None,
        is_super_user: bool,
        member: RpcOrganizationMemberSummary | None,
    ) -> RpcMemberSsoState:
        if organization_id is None:
            return _SSO_NONMEMBER

        # we special case superuser so that if they're a member of the org they must still follow SSO checks
        # or put another way, superusers who are not members of orgs bypass SSO.
        if member is None or member.user_id is None:
            if is_super_user:
                return _SSO_BYPASS
            return _SSO_NONMEMBER

        auth_provider = self.get_auth_provider(organization_id=organization_id)
        if auth_provider is None:
            return _SSO_BYPASS

        if auth_provider.flags.allow_unlinked:
            return _SSO_BYPASS
        else:
            requires_sso = True

            auth_identity = self.get_auth_identity_for_user(
                auth_provider_id=auth_provider.id, user_id=member.user_id
            )
            if auth_identity is None:
                sso_is_valid = False
                requires_sso = not self.can_override_sso_as_owner(auth_provider, member)
            else:
                sso_is_valid = self.auth_identity_is_valid(
                    auth_provider=auth_provider, auth_identity=auth_identity, member=member
                )

        return RpcMemberSsoState(is_required=requires_sso, is_valid=sso_is_valid)

    def get_user_auth_state(
        self,
        *,
        user_id: int | None,
        is_superuser: bool,
        is_staff: bool,
        organization_id: int | None,
        org_member: RpcOrganizationMemberSummary | None,
    ) -> RpcAuthState:
        sso_state = self.query_sso_state(
            organization_id=organization_id, is_super_user=is_superuser, member=org_member
        )

        # Unfortunately we are unable to combine the is_superuser and is_staff
        # into a single argument b/c query_sso_state specifically needs is_superuser
        if (is_superuser or is_staff) and user_id is not None:
            # "permissions" is a bit of a misnomer -- these are all admin level permissions, and the intent is that if you
            # have them, you can only use them when you are acting, as a superuser or staff.  This is intentional.
            permissions = list(self.get_permissions_for_user(user_id))
        else:
            permissions = []

        return RpcAuthState(sso_state=sso_state, permissions=permissions)

    @abc.abstractmethod
    def get_permissions_for_user(self, user_id: int) -> frozenset[str]:
        pass


def impl_by_region_resources() -> AccessService:
    from sentry.auth.services.access.impl import RegionAccessService

    return RegionAccessService()


def impl_by_control_resources() -> AccessService:
    from sentry.auth.services.access.impl import ControlAccessService

    return ControlAccessService()


access_service: AccessService = silo_mode_delegation(
    {
        SiloMode.REGION: impl_by_region_resources,
        SiloMode.CONTROL: impl_by_control_resources,
        SiloMode.MONOLITH: impl_by_control_resources,
    }
)

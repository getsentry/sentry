from sentry import roles
from sentry.auth.services.access.service import AccessService
from sentry.auth.services.auth import RpcAuthIdentity, RpcAuthProvider
from sentry.auth.services.auth.serial import (
    serialize_auth_identity,
    serialize_auth_identity_replica,
    serialize_auth_provider,
    serialize_auth_provider_replica,
)
from sentry.models.authidentity import AuthIdentity
from sentry.models.authidentityreplica import AuthIdentityReplica
from sentry.models.authprovider import AuthProvider
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization import RpcOrganizationMemberSummary
from sentry.users.services.user.service import user_service


class ControlAccessService(AccessService):
    def get_permissions_for_user(self, user_id: int) -> frozenset[str]:
        user = user_service.get_user(user_id)
        if user is None:
            return frozenset()
        return user.roles | user.permissions

    def get_auth_provider(self, organization_id: int) -> RpcAuthProvider | None:
        try:
            return serialize_auth_provider(
                AuthProvider.objects.get(organization_id=organization_id)
            )
        except AuthProvider.DoesNotExist:
            return None

    def get_auth_identity_for_user(
        self, auth_provider_id: int, user_id: int
    ) -> RpcAuthIdentity | None:
        try:
            return serialize_auth_identity(
                AuthIdentity.objects.get(auth_provider_id=auth_provider_id, user_id=user_id)
            )
        except AuthIdentity.DoesNotExist:
            return None

    def can_override_sso_as_owner(
        self, auth_provider: RpcAuthProvider, member: RpcOrganizationMemberSummary
    ) -> bool:
        """If an owner is trying to gain access, allow bypassing SSO if there are no
        other owners with SSO enabled.
        """
        # get member role
        try:
            member_role = OrganizationMemberMapping.objects.get(
                organizationmember_id=member.id, organization_id=member.organization_id
            ).role
        except OrganizationMemberMapping.DoesNotExist:
            return False

        if member_role != roles.get_top_dog().id:
            return False

        user_ids = (
            OrganizationMemberMapping.objects.filter(
                role=roles.get_top_dog().id,
                organization_id=member.organization_id,
                user__is_active=True,
            )
            .exclude(id=member.id)
            .values_list("user_id")
        )
        return not AuthIdentity.objects.filter(
            auth_provider_id=auth_provider.id, user__in=user_ids
        ).exists()


class RegionAccessService(AccessService):
    def get_auth_provider(self, organization_id: int) -> RpcAuthProvider | None:
        try:
            ap = AuthProviderReplica.objects.get(organization_id=organization_id)
            return serialize_auth_provider_replica(ap)
        except AuthProviderReplica.DoesNotExist:
            return None

    def get_auth_identity_for_user(
        self, auth_provider_id: int, user_id: int
    ) -> RpcAuthIdentity | None:
        try:
            ai = AuthIdentityReplica.objects.get(auth_provider_id=auth_provider_id, user_id=user_id)
            return serialize_auth_identity_replica(ai)
        except AuthIdentityReplica.DoesNotExist:
            return None

    def can_override_sso_as_owner(
        self, auth_provider: RpcAuthProvider, member: RpcOrganizationMemberSummary
    ) -> bool:
        # get member role
        try:
            member_role = OrganizationMember.objects.get(
                id=member.id, organization_id=member.organization_id
            ).role
        except OrganizationMember.DoesNotExist:
            return False

        if member_role != roles.get_top_dog().id:
            return False

        user_ids = (
            OrganizationMember.objects.filter(
                role=roles.get_top_dog().id,
                organization_id=member.organization_id,
                user_is_active=True,
            )
            .exclude(id=member.id)
            .values_list("user_id")
        )
        return not AuthIdentityReplica.objects.filter(
            auth_provider_id=auth_provider.id, user_id__in=user_ids
        ).exists()

    def get_permissions_for_user(self, user_id: int) -> frozenset[str]:
        user = user_service.get_user(user_id)
        if user is None:
            return frozenset()
        return user.roles | user.permissions

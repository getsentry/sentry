from typing import FrozenSet, Optional

from django.db.models import Q

from sentry import roles
from sentry.models import (
    AuthIdentity,
    AuthIdentityReplica,
    AuthProvider,
    AuthProviderReplica,
    OrganizationMember,
    OrganizationMemberMapping,
)
from sentry.services.hybrid_cloud.access.service import AccessService
from sentry.services.hybrid_cloud.auth import RpcAuthIdentity, RpcAuthProvider
from sentry.services.hybrid_cloud.auth.serial import (
    serialize_auth_identity,
    serialize_auth_identity_replica,
    serialize_auth_provider,
    serialize_auth_provider_replica,
)
from sentry.services.hybrid_cloud.organization import (
    RpcOrganizationMemberSummary,
    organization_service,
)
from sentry.services.hybrid_cloud.user.service import user_service


class ControlAccessService(AccessService):
    def get_permissions_for_user(self, user_id: int) -> FrozenSet[str]:
        user = user_service.get_user(user_id)
        if user is None:
            return frozenset()
        return user.roles | user.permissions

    def get_auth_provider(self, organization_id: int) -> Optional[RpcAuthProvider]:
        try:
            return serialize_auth_provider(
                AuthProvider.objects.get(organization_id=organization_id)
            )
        except AuthProvider.DoesNotExist:
            return None

    def get_auth_identity_for_user(
        self, auth_provider_id: int, user_id: int
    ) -> Optional[RpcAuthIdentity]:
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

        # Get more org role related data into control to reduce this inter silo rpc stuff....
        org_roles = organization_service.get_all_org_roles(
            member_id=member.id, organization_id=member.organization_id
        )
        if roles.get_top_dog().id not in org_roles:
            return False

        all_top_dogs_from_teams = organization_service.get_top_dog_team_member_ids(
            organization_id=member.organization_id
        )
        user_ids = (
            OrganizationMemberMapping.objects.filter(
                Q(id__in=all_top_dogs_from_teams) | Q(role=roles.get_top_dog().id),
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
    def get_auth_provider(self, organization_id: int) -> Optional[RpcAuthProvider]:
        try:
            ap = AuthProviderReplica.objects.get(organization_id=organization_id)
            return serialize_auth_provider_replica(ap)
        except AuthProviderReplica.DoesNotExist:
            return None

    def get_auth_identity_for_user(
        self, auth_provider_id: int, user_id: int
    ) -> Optional[RpcAuthIdentity]:
        try:
            ai = AuthIdentityReplica.objects.get(auth_provider_id=auth_provider_id, user_id=user_id)
            return serialize_auth_identity_replica(ai)
        except AuthIdentityReplica.DoesNotExist:
            return None

    def can_override_sso_as_owner(
        self, auth_provider: RpcAuthProvider, member: RpcOrganizationMemberSummary
    ) -> bool:
        org_roles = organization_service.get_all_org_roles(
            member_id=member.id, organization_id=member.organization_id
        )
        if roles.get_top_dog().id not in org_roles:
            return False

        all_top_dogs_from_teams = organization_service.get_top_dog_team_member_ids(
            organization_id=member.organization_id
        )
        user_ids = (
            OrganizationMember.objects.filter(
                Q(id__in=all_top_dogs_from_teams) | Q(role=roles.get_top_dog().id),
                organization_id=member.organization_id,
                user_is_active=True,
            )
            .exclude(id=member.id)
            .values_list("user_id")
        )
        return not AuthIdentityReplica.objects.filter(
            auth_provider_id=auth_provider.id, user_id__in=user_ids
        ).exists()

    def get_permissions_for_user(self, user_id: int) -> FrozenSet[str]:
        user = user_service.get_user(user_id)
        if user is None:
            return frozenset()
        return user.roles | user.permissions

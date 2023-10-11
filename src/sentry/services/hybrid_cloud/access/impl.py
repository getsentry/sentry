from typing import FrozenSet, List, Optional, Set

from django.db.models import Q

from sentry import roles
from sentry.models.authidentity import AuthIdentity
from sentry.models.authidentityreplica import AuthIdentityReplica
from sentry.models.authprovider import AuthProvider
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationmemberteamreplica import OrganizationMemberTeamReplica
from sentry.models.team import Team
from sentry.models.teamreplica import TeamReplica
from sentry.services.hybrid_cloud.access.service import AccessService
from sentry.services.hybrid_cloud.auth import RpcAuthIdentity, RpcAuthProvider
from sentry.services.hybrid_cloud.auth.serial import (
    serialize_auth_identity,
    serialize_auth_identity_replica,
    serialize_auth_provider,
    serialize_auth_provider_replica,
)
from sentry.services.hybrid_cloud.organization import RpcOrganizationMemberSummary
from sentry.services.hybrid_cloud.user.service import user_service


class ControlAccessService(AccessService):
    def get_all_org_roles(self, member_id: int, organization_id: int) -> List[str]:
        try:
            member = OrganizationMemberMapping.objects.get(
                organizationmember_id=member_id, organization_id=organization_id
            )
        except OrganizationMemberMapping.DoesNotExist:
            return []

        team_ids = OrganizationMemberTeamReplica.objects.filter(
            organizationmember_id=member_id, organization_id=organization_id
        ).values_list("team_id", flat=True)
        all_roles: Set[str] = set(
            TeamReplica.objects.filter(team_id__in=team_ids)
            .exclude(org_role=None)
            .values_list("org_role", flat=True)
        )
        all_roles.add(member.role)
        return list(all_roles)

    def get_top_dog_team_member_ids(self, organization_id: int) -> List[int]:
        owner_teams = list(
            TeamReplica.objects.filter(
                organization_id=organization_id, org_role=roles.get_top_dog().id
            ).values_list("team_id", flat=True)
        )
        return list(
            OrganizationMemberTeamReplica.objects.filter(team_id__in=owner_teams).values_list(
                "organizationmember_id", flat=True
            )
        )

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
        org_roles = self.get_all_org_roles(
            member_id=member.id, organization_id=member.organization_id
        )
        if roles.get_top_dog().id not in org_roles:
            return False

        all_top_dogs_from_teams = self.get_top_dog_team_member_ids(
            organization_id=member.organization_id
        )
        user_ids = (
            OrganizationMemberMapping.objects.filter(
                Q(organizationmember_id__in=all_top_dogs_from_teams)
                | Q(role=roles.get_top_dog().id),
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
    def get_all_org_roles(self, member_id: int, organization_id: int) -> List[str]:
        try:
            member = OrganizationMember.objects.get(id=member_id, organization_id=organization_id)
        except OrganizationMember.DoesNotExist:
            return []

        team_ids = OrganizationMemberTeam.objects.filter(
            organizationmember_id=member.id
        ).values_list("team_id", flat=True)
        all_roles: Set[str] = set(
            Team.objects.filter(id__in=team_ids)
            .exclude(org_role=None)
            .values_list("org_role", flat=True)
        )
        all_roles.add(member.role)
        return list(all_roles)

    def get_top_dog_team_member_ids(self, organization_id: int) -> List[int]:
        owner_teams = list(
            Team.objects.filter(
                organization_id=organization_id, org_role=roles.get_top_dog().id
            ).values_list("id", flat=True)
        )
        return list(
            OrganizationMemberTeam.objects.filter(team_id__in=owner_teams).values_list(
                "organizationmember_id", flat=True
            )
        )

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
        org_roles = self.get_all_org_roles(
            member_id=member.id, organization_id=member.organization_id
        )
        if roles.get_top_dog().id not in org_roles:
            return False

        all_top_dogs_from_teams = self.get_top_dog_team_member_ids(
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

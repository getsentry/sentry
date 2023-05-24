from __future__ import annotations

from typing import Iterable, List, Optional, Set, cast

from django.db import models, transaction

from sentry import roles
from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    Team,
)
from sentry.models.organizationmember import InviteStatus
from sentry.services.hybrid_cloud import logger
from sentry.services.hybrid_cloud.organization import (
    OrganizationService,
    RpcOrganizationInvite,
    RpcOrganizationMember,
    RpcOrganizationMemberFlags,
    RpcOrganizationSummary,
    RpcUserInviteContext,
    RpcUserOrganizationContext,
)
from sentry.services.hybrid_cloud.organization.serial import (
    serialize_member,
    serialize_organization,
    serialize_organization_summary,
)
from sentry.services.hybrid_cloud.util import flags_to_bits


class DatabaseBackedOrganizationService(OrganizationService):
    def check_membership_by_id(
        self, organization_id: int, user_id: int
    ) -> Optional[RpcOrganizationMember]:
        from sentry.auth.access import get_cached_organization_member

        try:
            member = get_cached_organization_member(
                user_id=user_id, organization_id=organization_id
            )
        except OrganizationMember.DoesNotExist:
            return None

        return serialize_member(member)

    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int] = None, slug: Optional[str] = None
    ) -> Optional[RpcUserOrganizationContext]:
        membership: Optional[RpcOrganizationMember] = None
        if user_id is not None:
            membership = self.check_membership_by_id(organization_id=id, user_id=user_id)

        try:
            query = Organization.objects.filter(id=id)
            if slug is not None:
                query = query.filter(slug=slug)
            org = query.get()
        except Organization.DoesNotExist:
            return None

        return RpcUserOrganizationContext(
            user_id=user_id, organization=serialize_organization(org), member=membership
        )

    def get_org_by_slug(
        self,
        *,
        slug: str,
        user_id: Optional[int] = None,
    ) -> Optional[RpcOrganizationSummary]:
        query = Organization.objects.filter(slug=slug)
        if user_id is not None:
            query = query.filter(
                status=OrganizationStatus.ACTIVE,
                member_set__user_id=user_id,
            )
        try:
            return serialize_organization_summary(query.get())
        except Organization.DoesNotExist:
            return None

    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[RpcOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(organization_id=organization_id, email=email)
        except OrganizationMember.DoesNotExist:
            return None

        return serialize_member(member)

    def get_invite_by_id(
        self,
        *,
        organization_id: int,
        organization_member_id: Optional[int] = None,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcUserInviteContext]:
        """
        Query for an organization member by its id.
        """
        query = Organization.objects.filter(id=organization_id)

        try:
            org = query.get()
        except Organization.DoesNotExist:
            return None

        return self._get_invite(
            organization_member_id=organization_member_id,
            org=org,
            user_id=user_id,
            email=email,
        )

    def get_invite_by_slug(
        self,
        *,
        slug: str,
        organization_member_id: Optional[int] = None,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcUserInviteContext]:
        """
        Query for an organization member by its slug.
        """
        query = Organization.objects.filter(slug=slug)

        try:
            org = query.get()
        except Organization.DoesNotExist:
            return None

        return self._get_invite(
            organization_member_id=organization_member_id,
            org=org,
            user_id=user_id,
            email=email,
        )

    def _get_invite(
        self,
        *,
        organization_member_id: Optional[int] = None,
        org: Organization,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcUserInviteContext]:
        """
        Query for an organization member by its id and organization
        """

        member: RpcOrganizationMember | None = None
        if user_id is not None:
            member = OrganizationMember.objects.filter(
                organization_id=org.id, user_id=user_id
            ).first()
        if member is None and email is not None:
            member = OrganizationMember.objects.filter(organization_id=org.id, email=email).first()
        if member is None and organization_member_id is not None:
            member = OrganizationMember.objects.filter(
                organization_id=org.id, id=organization_member_id
            ).first()

        if member is None:
            return None

        return RpcUserInviteContext(
            user_id=member.user_id,
            organization=serialize_organization(org),
            member=serialize_member(member),
            invite_organization_member_id=organization_member_id,
        )

    def delete_organization_member(
        self, *, organization_id: int, organization_member_id: int
    ) -> bool:
        try:
            member = OrganizationMember.objects.get(id=organization_member_id)
        except OrganizationMember.DoesNotExist:
            return False
        num_deleted, _deleted = member.delete()
        return num_deleted > 0  # type: ignore[no-any-return]

    def set_user_for_organization_member(
        self,
        *,
        organization_member_id: int,
        organization_id: int,
        user_id: int,
    ) -> Optional[RpcOrganizationMember]:
        region_outbox = None
        with transaction.atomic():
            try:
                org_member = OrganizationMember.objects.get(
                    user_id=user_id, organization_id=organization_id
                )
                return serialize_member(org_member)
            except OrganizationMember.DoesNotExist:
                try:
                    org_member = OrganizationMember.objects.get(
                        id=organization_member_id, organization_id=organization_id
                    )
                    org_member.set_user(user_id)
                    org_member.save()
                    region_outbox = org_member.outbox_for_update()
                    region_outbox.save()
                except OrganizationMember.DoesNotExist:
                    return None
        if region_outbox:
            region_outbox.drain_shard(max_updates_to_drain=10)
        return serialize_member(org_member)

    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        try:
            org = Organization.objects.get_from_cache(slug=slug)
            if only_visible and org.status != OrganizationStatus.ACTIVE:
                raise Organization.DoesNotExist
            return cast(int, org.id)
        except Organization.DoesNotExist:
            logger.info("Organization by slug [%s] not found", slug)

        return None

    def close(self) -> None:
        pass

    def get_organizations(
        self,
        *,
        user_id: Optional[int],
        scope: Optional[str],
        only_visible: bool,
        organization_ids: Optional[List[int]] = None,
    ) -> List[RpcOrganizationSummary]:
        # This needs to query the control tables for organization data and not the region ones, because spanning out
        # would be very expansive.
        if user_id is not None:
            organizations = self._query_organizations(user_id, scope, only_visible)
        elif organization_ids is not None:
            qs = Organization.objects.filter(id__in=organization_ids)
            if only_visible:
                qs = qs.filter(status=OrganizationStatus.ACTIVE)
            organizations = list(qs)
        else:
            organizations = []
        return [serialize_organization_summary(o) for o in organizations]

    def _query_organizations(
        self, user_id: int, scope: Optional[str], only_visible: bool
    ) -> List[Organization]:
        from django.conf import settings

        if settings.SENTRY_PUBLIC and scope is None:
            if only_visible:
                return list(Organization.objects.filter(status=OrganizationStatus.ACTIVE))
            else:
                return list(Organization.objects.filter())

        qs = OrganizationMember.objects.filter(user_id=user_id)

        qs = qs.select_related("organization")
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.ACTIVE)

        results = list(qs)

        if scope is not None:
            return [r.organization for r in results if scope in r.get_scopes()]

        return [r.organization for r in results]

    @staticmethod
    def _deserialize_member_flags(flags: RpcOrganizationMemberFlags) -> int:
        return flags_to_bits(flags.sso__linked, flags.sso__invalid, flags.member_limit__restricted)

    def add_organization_member(
        self,
        *,
        organization_id: int,
        default_org_role: str,
        user_id: int | None = None,
        email: str | None = None,
        flags: RpcOrganizationMemberFlags | None = None,
        role: str | None = None,
        inviter_id: int | None = None,
        invite_status: int | None = None,
    ) -> RpcOrganizationMember:
        assert (user_id is None and email) or (
            user_id and email is None
        ), "Must set either user_id or email"
        if invite_status is None:
            invite_status = InviteStatus.APPROVED.value
        region_outbox = None
        with transaction.atomic(), in_test_psql_role_override("postgres"):
            org_member: OrganizationMember = OrganizationMember.objects.create(
                organization_id=organization_id,
                user_id=user_id,
                email=email,
                flags=self._deserialize_member_flags(flags) if flags else 0,
                role=role or default_org_role,
                inviter_id=inviter_id,
                invite_status=invite_status,
            )
            region_outbox = org_member.save_outbox_for_create()
        if region_outbox:
            region_outbox.drain_shard(max_updates_to_drain=10)
        return serialize_member(org_member)

    def add_team_member(self, *, team_id: int, organization_member: RpcOrganizationMember) -> None:
        OrganizationMemberTeam.objects.create(
            team_id=team_id, organizationmember_id=organization_member.id
        )
        # It might be nice to return an RpcTeamMember to represent what we just
        # created, but doing so would require a list of project IDs. We can implement
        # that if a return value is needed in the future.

    def get_team_members(self, *, team_id: int) -> Iterable[RpcOrganizationMember]:
        team_members = OrganizationMemberTeam.objects.filter(team_id=team_id)
        return [serialize_member(team_member.organizationmember) for team_member in team_members]

    def update_membership_flags(self, *, organization_member: RpcOrganizationMember) -> None:
        model = OrganizationMember.objects.get(id=organization_member.id)
        model.flags = self._deserialize_member_flags(organization_member.flags)
        model.save()

    @classmethod
    def _serialize_invite(cls, om: OrganizationMember) -> RpcOrganizationInvite:
        return RpcOrganizationInvite(id=om.id, token=om.token, email=om.email)

    def get_all_org_roles(
        self,
        organization_member: Optional[RpcOrganizationMember] = None,
        member_id: Optional[int] = None,
    ) -> List[str]:
        if member_id:
            member = OrganizationMember.objects.get(id=member_id)
            organization_member = serialize_member(member)

        org_roles: List[str] = []
        if organization_member:
            team_ids = [mt.team_id for mt in organization_member.member_teams]
            all_roles: Set[str] = set(
                Team.objects.filter(id__in=team_ids)
                .exclude(org_role=None)
                .values_list("org_role", flat=True)
            )
            all_roles.add(organization_member.role)
            org_roles.extend(list(all_roles))
        return org_roles

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

    def remove_user(self, *, organization_id: int, user_id: int) -> RpcOrganizationMember:
        region_outbox = None
        with transaction.atomic(), in_test_psql_role_override("postgres"):
            org_member = OrganizationMember.objects.get(
                organization_id=organization_id, user_id=user_id
            )
            org_member.remove_user()
            region_outbox = org_member.save()
        if region_outbox:
            region_outbox.drain_shard(max_updates_to_drain=10)
        return serialize_member(org_member)

    def reset_idp_flags(self, *, organization_id: int) -> None:
        OrganizationMember.objects.filter(
            organization_id=organization_id,
            flags=models.F("flags").bitor(OrganizationMember.flags["idp:provisioned"]),
        ).update(
            flags=models.F("flags")
            .bitand(~OrganizationMember.flags["idp:provisioned"])
            .bitand(~OrganizationMember.flags["idp:role-restricted"])
        )

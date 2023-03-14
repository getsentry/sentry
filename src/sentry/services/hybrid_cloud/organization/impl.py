from __future__ import annotations

import dataclasses
from collections import defaultdict
from typing import TYPE_CHECKING, Iterable, List, MutableMapping, Optional, Set, cast

from sentry import roles
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    Project,
    ProjectStatus,
    ProjectTeam,
    Team,
    TeamStatus,
)
from sentry.services.hybrid_cloud import logger
from sentry.services.hybrid_cloud.organization import (
    OrganizationService,
    RpcOrganization,
    RpcOrganizationFlags,
    RpcOrganizationInvite,
    RpcOrganizationMember,
    RpcOrganizationMemberFlags,
    RpcOrganizationMemberSummary,
    RpcOrganizationSummary,
    RpcProject,
    RpcTeam,
    RpcTeamMember,
    RpcUserOrganizationContext,
)
from sentry.services.hybrid_cloud.util import flags_to_bits

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.user import RpcUser


def escape_flag_name(flag_name: str) -> str:
    return flag_name.replace(":", "__").replace("-", "_")


def unescape_flag_name(flag_name: str) -> str:
    return flag_name.replace("__", ":").replace("_", "-")


class DatabaseBackedOrganizationService(OrganizationService):
    @classmethod
    def _serialize_member_flags(cls, member: OrganizationMember) -> RpcOrganizationMemberFlags:
        result = RpcOrganizationMemberFlags()
        for f in dataclasses.fields(RpcOrganizationMemberFlags):
            setattr(result, f.name, bool(getattr(member.flags, unescape_flag_name(f.name))))
        return result

    @classmethod
    def serialize_member(
        cls,
        member: OrganizationMember,
    ) -> RpcOrganizationMember:
        rpc_member = RpcOrganizationMember(
            id=member.id,
            organization_id=member.organization_id,
            user_id=member.user.id if member.user is not None else None,
            role=member.role,
            has_global_access=member.has_global_access,
            scopes=list(member.get_scopes()),
            flags=cls._serialize_member_flags(member),
        )

        omts = OrganizationMemberTeam.objects.filter(
            organizationmember=member, is_active=True, team__status=TeamStatus.VISIBLE
        )

        all_project_ids: Set[int] = set()
        project_ids_by_team_id: MutableMapping[int, List[int]] = defaultdict(list)
        for pt in ProjectTeam.objects.filter(
            project__status=ProjectStatus.VISIBLE, team_id__in={omt.team_id for omt in omts}
        ):
            all_project_ids.add(pt.project_id)
            project_ids_by_team_id[pt.team_id].append(pt.project_id)

        for omt in omts:
            omt.organizationmember = member
            rpc_member.member_teams.append(
                cls._serialize_team_member(omt, project_ids_by_team_id[omt.team_id])
            )
        rpc_member.project_ids = list(all_project_ids)

        return rpc_member

    @classmethod
    def summarize_member(
        cls,
        member: OrganizationMember,
    ) -> RpcOrganizationMemberSummary:
        return RpcOrganizationMemberSummary(
            id=member.id,
            organization_id=member.organization_id,
            user_id=member.user_id,
            flags=cls._serialize_member_flags(member),
        )

    @classmethod
    def _serialize_flags(cls, org: Organization) -> RpcOrganizationFlags:
        result = RpcOrganizationFlags()
        for f in dataclasses.fields(result):
            setattr(result, f.name, getattr(org.flags, f.name))
        return result

    @classmethod
    def _serialize_team(cls, team: Team) -> RpcTeam:
        return RpcTeam(
            id=team.id,
            status=team.status,
            organization_id=team.organization_id,
            slug=team.slug,
            org_role=team.org_role,
        )

    @classmethod
    def _serialize_team_member(
        cls, team_member: OrganizationMemberTeam, project_ids: Iterable[int]
    ) -> RpcTeamMember:
        result = RpcTeamMember(
            id=team_member.id,
            is_active=team_member.is_active,
            role=team_member.get_team_role(),
            team_id=team_member.team_id,
            project_ids=list(project_ids),
            scopes=list(team_member.get_scopes()),
        )

        return result

    @classmethod
    def _serialize_project(cls, project: Project) -> RpcProject:
        return RpcProject(
            id=project.id,
            slug=project.slug,
            name=project.name,
            organization_id=project.organization_id,
            status=project.status,
        )

    def _serialize_organization_summary(self, org: Organization) -> RpcOrganizationSummary:
        return RpcOrganizationSummary(
            slug=org.slug,
            id=org.id,
            name=org.name,
        )

    @classmethod
    def serialize_organization(cls, org: Organization) -> RpcOrganization:
        rpc_org: RpcOrganization = RpcOrganization(
            slug=org.slug,
            id=org.id,
            flags=cls._serialize_flags(org),
            name=org.name,
            status=org.status,
            default_role=org.default_role,
        )

        projects: List[Project] = Project.objects.filter(organization=org)
        teams: List[Team] = Team.objects.filter(organization=org)
        rpc_org.projects.extend(cls._serialize_project(project) for project in projects)
        rpc_org.teams.extend(cls._serialize_team(team) for team in teams)
        return rpc_org

    def check_membership_by_id(
        self, organization_id: int, user_id: int
    ) -> Optional[RpcOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(
                organization_id=organization_id, user_id=user_id
            )
        except OrganizationMember.DoesNotExist:
            return None

        return self.serialize_member(member)

    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int] = None, slug: Optional[str] = None
    ) -> Optional[RpcUserOrganizationContext]:
        membership: Optional[RpcOrganizationMember] = None
        if user_id is not None:
            try:
                om = OrganizationMember.objects.get(organization_id=id, user_id=user_id)
                membership = self.serialize_member(om)
            except OrganizationMember.DoesNotExist:
                pass

        try:
            query = Organization.objects.filter(id=id)
            if slug is not None:
                query = query.filter(slug=slug)
            org = query.get()
        except Organization.DoesNotExist:
            return None

        return RpcUserOrganizationContext(
            user_id=user_id, organization=self.serialize_organization(org), member=membership
        )

    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[RpcOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(organization_id=organization_id, email=email)
        except OrganizationMember.DoesNotExist:
            return None

        return self.serialize_member(member)

    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        try:
            org = Organization.objects.get_from_cache(slug=slug)
            if only_visible and org.status != OrganizationStatus.VISIBLE:
                raise Organization.DoesNotExist
            return cast(int, org.id)
        except Organization.DoesNotExist:
            logger.info("Organization by slug [%s] not found", slug)

        return None

    def close(self) -> None:
        pass

    def get_organizations(
        self,
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
                qs = qs.filter(status=OrganizationStatus.VISIBLE)
            organizations = list(qs)
        else:
            organizations = []
        return [self._serialize_organization_summary(o) for o in organizations]

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
        organization: RpcOrganization,
        user: RpcUser,
        flags: RpcOrganizationMemberFlags | None,
        role: str | None,
    ) -> RpcOrganizationMember:
        member = OrganizationMember.objects.create(
            organization_id=organization.id,
            user_id=user.id,
            flags=self._deserialize_member_flags(flags) if flags else 0,
            role=role or organization.default_role,
        )
        return self.serialize_member(member)

    def add_team_member(self, *, team_id: int, organization_member: RpcOrganizationMember) -> None:
        OrganizationMemberTeam.objects.create(
            team_id=team_id, organizationmember_id=organization_member.id
        )
        # It might be nice to return an RpcTeamMember to represent what we just
        # created, but doing so would require a list of project IDs. We can implement
        # that if a return value is needed in the future.

    def update_membership_flags(self, *, organization_member: RpcOrganizationMember) -> None:
        model = OrganizationMember.objects.get(id=organization_member.id)
        model.flags = self._deserialize_member_flags(organization_member.flags)
        model.save()

    @classmethod
    def _serialize_invite(cls, om: OrganizationMember) -> RpcOrganizationInvite:
        return RpcOrganizationInvite(om.id, om.token, om.email)

    def get_all_org_roles(
        self,
        organization_member: Optional[RpcOrganizationMember] = None,
        member_id: Optional[int] = None,
    ) -> List[str]:
        if member_id:
            member = OrganizationMember.objects.get(id=member_id)
            organization_member = self.serialize_member(member)

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

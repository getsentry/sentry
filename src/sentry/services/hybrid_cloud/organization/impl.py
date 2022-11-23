import dataclasses
from collections import defaultdict
from typing import Iterable, List, MutableMapping, Optional, Set, cast

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
    ApiOrganization,
    ApiOrganizationFlags,
    ApiOrganizationMember,
    ApiOrganizationMemberFlags,
    ApiProject,
    ApiTeam,
    ApiTeamMember,
    ApiUserOrganizationContext,
    OrganizationService,
)


def escape_flag_name(flag_name: str) -> str:
    return flag_name.replace(":", "__").replace("-", "_")


def unescape_flag_name(flag_name: str) -> str:
    return flag_name.replace("__", ":").replace("_", "-")


class DatabaseBackedOrganizationService(OrganizationService):
    def _serialize_member_flags(self, member: "OrganizationMember") -> "ApiOrganizationMemberFlags":
        result = ApiOrganizationMemberFlags()
        for f in dataclasses.fields(ApiOrganizationMemberFlags):
            setattr(result, f.name, getattr(member.flags, unescape_flag_name(f.name)))
        return result

    def _serialize_member(
        self,
        member: "OrganizationMember",
    ) -> "ApiOrganizationMember":
        api_member = ApiOrganizationMember(
            id=member.id,
            organization_id=member.organization_id,
            user_id=member.user.id if member.user is not None else None,
            role=member.role,
            scopes=list(member.get_scopes()),
            flags=self._serialize_member_flags(member),
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
            api_member.member_teams.append(
                self._serialize_team_member(omt, project_ids_by_team_id[omt.team_id])
            )
        api_member.project_ids = list(all_project_ids)

        return api_member

    def _serialize_flags(self, org: "Organization") -> "ApiOrganizationFlags":
        result = ApiOrganizationFlags()
        for f in dataclasses.fields(result):
            setattr(result, f.name, getattr(org.flags, f.name))
        return result

    def _serialize_team(self, team: Team) -> "ApiTeam":
        return ApiTeam(
            id=team.id,
            status=team.status,
            organization_id=team.organization_id,
            slug=team.slug,
        )

    def _serialize_team_member(
        self, team_member: OrganizationMemberTeam, project_ids: Iterable[int]
    ) -> "ApiTeamMember":
        result = ApiTeamMember(
            id=team_member.id,
            is_active=team_member.is_active,
            role=team_member.get_team_role(),
            team_id=team_member.team_id,
            project_ids=list(project_ids),
        )

        return result

    def _serialize_project(self, project: Project) -> "ApiProject":
        return ApiProject(
            id=project.id,
            slug=project.slug,
            name=project.name,
            organization_id=project.organization_id,
            status=project.status,
        )

    def _serialize_organization(self, org: "Organization") -> "ApiOrganization":
        api_org: ApiOrganization = ApiOrganization(
            slug=org.slug,
            id=org.id,
            flags=self._serialize_flags(org),
            name=org.name,
        )

        projects: List[Project] = Project.objects.filter(organization=org)
        teams: List[Team] = Team.objects.filter(organization=org)
        api_org.projects.extend(self._serialize_project(project) for project in projects)
        api_org.teams.extend(self._serialize_team(team) for team in teams)
        return api_org

    def check_membership_by_id(
        self, organization_id: int, user_id: int
    ) -> Optional[ApiOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(
                organization_id=organization_id, user_id=user_id
            )
        except OrganizationMember.DoesNotExist:
            return None

        return self._serialize_member(member)

    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int]
    ) -> Optional[ApiUserOrganizationContext]:
        membership: Optional[ApiOrganizationMember] = None
        if user_id is not None:
            try:
                om = OrganizationMember.objects.get(organization_id=id, user_id=user_id)
                membership = self._serialize_member(om)
            except OrganizationMember.DoesNotExist:
                pass

        try:
            org = Organization.objects.get(id=id)
        except Organization.DoesNotExist:
            return None

        return ApiUserOrganizationContext(
            user_id=user_id, organization=self._serialize_organization(org), member=membership
        )

    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[ApiOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(organization_id=organization_id, email=email)
        except OrganizationMember.DoesNotExist:
            return None

        return self._serialize_member(member)

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
    ) -> List[ApiOrganization]:
        if user_id is not None:
            organizations = self._query_organizations(user_id, scope, only_visible)
        elif organization_ids is not None:
            qs = Organization.objects.filter(id__in=organization_ids)
            if only_visible:
                qs = qs.filter(status=OrganizationStatus.VISIBLE)
            organizations = list(qs)
        else:
            organizations = []
        return [self._serialize_organization(o) for o in organizations]

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

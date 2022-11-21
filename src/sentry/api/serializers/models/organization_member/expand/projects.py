from collections import defaultdict
from typing import Any, Mapping, MutableMapping, Sequence, cast

from sentry.models import OrganizationMember, OrganizationMemberTeam, ProjectTeam, TeamStatus, User

from ..base import OrganizationMemberSerializer
from ..response import OrganizationMemberWithProjectsResponse


class OrganizationMemberWithProjectsSerializer(OrganizationMemberSerializer):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.projects = {p.id: p for p in kwargs.pop("projects", [])}
        self.project_ids = set(self.projects.keys())
        super().__init__(*args, **kwargs)

    def get_attrs(
        self, item_list: Sequence[OrganizationMember], user: User, **kwargs: Any
    ) -> MutableMapping[OrganizationMember, MutableMapping[str, Any]]:
        attrs = super().get_attrs(item_list, user)

        # Get all the OrganizationMemberTeam relations so we can map
        # the member id to the list of team ids
        #
        # Note that we're intentionally only working with `team_id`
        # to avoid having to fetch the team model as well.
        member_teams = OrganizationMemberTeam.objects.filter(
            organizationmember_id__in=[om.id for om in item_list],
            team__status=TeamStatus.VISIBLE,
        ).values_list("team_id", "organizationmember_id", named=True)

        # The set of team ids, this will be used to filter down the `ProjectTeam` below
        team_ids = set()

        # Mapping from member id to team ids they belong to.
        #
        # Previously, we were using a `select_related` when fetching the OrganizationMember.
        # This resulted in django trying to set the attributes for the many to many relation
        # which was slow.
        team_ids_by_member_id = defaultdict(list)

        # Be very careful here. We are intentionally only using `team_id` and `organizationmember_id`.
        # This is to stop django from fetching these models. We don't even want django to do
        # any kind of prefetching here.
        for member_team in member_teams:
            team_ids.add(member_team.team_id)
            team_ids_by_member_id[member_team.organizationmember_id].append(member_team.team_id)

        # Mapping from team id to projects that belong to the team.
        #
        # We require the caller to pass in the list of projects (not just ids to avoid an extra query)
        # Make sure we only work with `team_id` and not the team object so django doesn't fetching it.
        projects_by_team_id = defaultdict(list)

        for project_team in ProjectTeam.objects.filter(
            project_id__in=self.project_ids,
            team_id__in=team_ids,
        ).values_list("team_id", "project_id", named=True):
            projects_by_team_id[project_team.team_id].append(self.projects[project_team.project_id])

        for org_member in item_list:
            projects = set()
            for team_id in team_ids_by_member_id[org_member.id]:
                for project in projects_by_team_id[team_id]:
                    projects.add(project.slug)

            projects_list = list(projects)
            projects_list.sort()
            attrs[org_member]["projects"] = projects_list
        return attrs

    def serialize(
        self, obj: OrganizationMember, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> OrganizationMemberWithProjectsResponse:
        d = cast(OrganizationMemberWithProjectsResponse, super().serialize(obj, attrs, user))

        d["projects"] = attrs.get("projects", [])
        return d

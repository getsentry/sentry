from collections import defaultdict
from typing import Any, Mapping, MutableMapping, Sequence, cast

from sentry.models import OrganizationMember, ProjectTeam, TeamStatus, User

from ..base import OrganizationMemberSerializer
from ..response import OrganizationMemberWithProjectsResponse


class OrganizationMemberWithProjectsSerializer(OrganizationMemberSerializer):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.project_ids = set(kwargs.pop("project_ids", []))
        super().__init__(*args, **kwargs)

    def get_attrs(
        self, item_list: Sequence[OrganizationMember], user: User, **kwargs: Any
    ) -> MutableMapping[OrganizationMember, MutableMapping[str, Any]]:
        """
        Note: For this to be efficient, call
        `.prefetch_related('teams')`
        on your queryset before using this serializer
        """

        attrs = super().get_attrs(item_list, user)

        team_ids = set()
        for org_member in item_list:
            for team in org_member.teams.all():
                team_ids.add(team.id)

        projects_by_team = defaultdict(list)

        for project_team in ProjectTeam.objects.filter(
            project_id__in=self.project_ids,
            team_id__in=team_ids,
        ).select_related("project"):
            projects_by_team[project_team.team_id].append(project_team.project.slug)

        for org_member in item_list:
            projects = set()
            for team in org_member.teams.all():
                # Filter in python here so that we don't break the prefetch
                if team.status != TeamStatus.VISIBLE:
                    continue

                for project in projects_by_team[team.id]:
                    projects.add(project)

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

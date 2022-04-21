from typing import Any, Mapping, MutableMapping, Sequence, cast

from sentry.models import OrganizationMember, TeamStatus, User

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
        `.prefetch_related(
              'teams',
              'teams__projectteam_set',
              'teams__projectteam_set__project',
        )` on your queryset before using this serializer
        """

        attrs = super().get_attrs(item_list, user)
        for org_member in item_list:
            projects = set()
            for team in org_member.teams.all():
                # Filter in python here so that we don't break the prefetch
                if team.status != TeamStatus.VISIBLE:
                    continue

                for project_team in team.projectteam_set.all():
                    if (
                        project_team.project_id in self.project_ids
                        and project_team.project.status == TeamStatus.VISIBLE
                    ):
                        projects.add(project_team.project.slug)

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

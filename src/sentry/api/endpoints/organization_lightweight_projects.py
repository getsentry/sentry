from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationAndStaffPermission, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.models.environment import EnvironmentProject
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projectteam import ProjectTeam
from sentry.models.user import User


class LightWeightProjectSerializer(Serializer):
    def get_attrs(self, item_list: Sequence[Project], user: User, **kwargs: Any):
        environments_by_project = get_environments_by_projects(item_list)
        memberships_by_project = get_access_by_project(item_list, user)
        return {
            project: {
                "environments": environments_by_project[project.id],
                "isMember": memberships_by_project[project.id],
            }
            for project in item_list
        }

    def serialize(self, obj: Project, attrs: Mapping[str, Any], user: User):
        return {
            "slug": obj.slug,
            "id": obj.id,
            "platform": obj.platform,
            "environments": attrs["environments"],
            "isMember": attrs["isMember"],
        }


@region_silo_endpoint
class OrganizationLightweightProjectsEndpoint(OrganizationEndpoint, EnvironmentMixin):
    # this is for the UI only
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationAndStaffPermission,)

    def get(self, request: Request, organization) -> Response:
        """
        Return a list of projects bound to a organization.
        """
        queryset = Project.objects.filter(organization=organization)

        def serialize_on_result(result):
            serializer = LightWeightProjectSerializer()
            return serialize(result, request.user, serializer)

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=serialize_on_result,
            paginator_cls=OffsetPaginator,
        )


def get_environments_by_projects(projects):
    project_envs = (
        EnvironmentProject.objects.filter(
            project_id__in=[i.id for i in projects],
            # Including the organization_id is necessary for postgres to use indexes
            # efficiently.
            environment__organization_id=projects[0].organization_id,
        )
        .exclude(
            is_hidden=True,
            # HACK(lb): avoiding the no environment value
        )
        .exclude(environment__name="")
        .values("project_id", "environment__name")
    )

    environments_by_project = defaultdict(list)
    for project_env in project_envs:
        environments_by_project[project_env["project_id"]].append(project_env["environment__name"])
    return environments_by_project


def get_access_by_project(
    projects: Sequence[Project], user: User
) -> MutableMapping[Project, MutableMapping[str, Any]]:

    project_teams = ProjectTeam.objects.filter(project__in=projects).values_list(
        "project_id", "team_id"
    )

    project_to_teams = defaultdict(set)
    teams_list = set()
    for project_id, team_id in project_teams:
        project_to_teams[project_id].add(team_id)
        teams_list.add(team_id)

    team_memberships = set(
        OrganizationMemberTeam.objects.filter(
            organizationmember__user_id=user.id, team__in=teams_list
        ).values_list("team_id", flat=True)
    )

    result = {}
    with sentry_sdk.start_span(op="project.check-access"):
        for project in projects:
            result[project.id] = bool(project_to_teams[project.id] & team_memberships)

    return result

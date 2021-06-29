import sentry_sdk
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models import OrganizationMemberWithProjectsSerializer
from sentry.models import OrganizationMember, OrganizationMemberTeam, ProjectTeam


class OrganizationUsersEndpoint(OrganizationEndpoint, EnvironmentMixin):
    def get(self, request, organization):
        """
        List an Organization's Users
        ````````````````````````````

        Return a list of users that belong to a given organization.

        :qparam string project: restrict results to users who have access to a given project ID
        :pparam string organization_slug: the slug of the organization for which the users
                                          should be listed.
        :auth: required
        """
        projects = self.get_projects(request, organization)

        with sentry_sdk.start_span(op="OrganizationUsersEndpoint.get_members") as span:
            qs = (
                OrganizationMember.objects.filter(
                    user__is_active=True,
                    organization=organization,
                    id__in=OrganizationMemberTeam.objects.filter(
                        team_id__in=ProjectTeam.objects.filter(project_id__in=projects)
                        .values_list("team_id", flat=True)
                        .distinct(),
                    ).values_list("organizationmember_id", flat=True),
                )
                .select_related("user")
                .prefetch_related(
                    "teams", "teams__projectteam_set", "teams__projectteam_set__project"
                )
                .order_by("user__email")
            )
            organization_members = list(qs)

            span.set_data("Project Count", len(projects))
            span.set_data("Member Count", len(organization_members))

        return Response(
            serialize(
                organization_members,
                request.user,
                serializer=OrganizationMemberWithProjectsSerializer(
                    project_ids=[p.id for p in projects]
                ),
            )
        )

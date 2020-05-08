from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models import OrganizationMemberWithProjectsSerializer
from sentry.models import OrganizationMember
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario("ListOrganizationUsers")
def list_organization_users_scenario(runner):
    runner.request(method="GET", path="/organizations/%s/users/" % runner.org.slug)


class OrganizationUsersEndpoint(OrganizationEndpoint, EnvironmentMixin):
    doc_section = DocSection.ORGANIZATIONS

    @attach_scenarios([list_organization_users_scenario])
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
        qs = (
            OrganizationMember.objects.filter(
                user__is_active=True,
                organization=organization,
                teams__projectteam__project__in=projects,
            )
            .select_related("user")
            .prefetch_related("teams", "teams__projectteam_set", "teams__projectteam_set__project")
            .order_by("user__email")
            .distinct()
        )

        return Response(
            serialize(
                list(qs),
                request.user,
                serializer=OrganizationMemberWithProjectsSerializer(
                    project_ids=[p.id for p in projects]
                ),
            )
        )

from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.helpers.environments import environment_visibility_filter_options
from sentry.api.serializers import serialize
from sentry.models import Environment, EnvironmentProject


class OrganizationEnvironmentsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        visibility = request.GET.get("visibility", "visible")
        if visibility not in environment_visibility_filter_options:
            return Response(
                {
                    "detail": u"Invalid value for 'visibility', valid values are: {!r}".format(
                        environment_visibility_filter_options.keys()
                    )
                },
                status=400,
            )
        environment_projects = EnvironmentProject.objects.filter(
            project__in=self.get_projects(request, organization)
        )
        add_visibility_filters = environment_visibility_filter_options[visibility]
        environment_projects = add_visibility_filters(environment_projects).values("environment")
        queryset = (
            Environment.objects.filter(id__in=environment_projects)
            .exclude(
                # HACK(mattrobenolt): We don't want to surface the
                # "No Environment" environment to the UI since it
                # doesn't really exist. This might very likely change
                # with new tagstore backend in the future, but until
                # then, we're hiding it since it causes more problems
                # than it's worth.
                name=""
            )
            .order_by("name")
        )
        return Response(serialize(list(queryset), request.user))

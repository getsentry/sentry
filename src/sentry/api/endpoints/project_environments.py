from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.environments import environment_visibility_filter_options
from sentry.api.serializers import serialize
from sentry.models import EnvironmentProject


class ProjectEnvironmentsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a Project's Environments
        ```````````````````````````````

        Return environments for a given project.

        :qparam string visibility: when omitted only visible environments are
                                   returned. Set to ``"hidden"`` for only hidden
                                   environments, or ``"all"`` for both hidden
                                   and visible environments.

        :pparam string organization_slug: the slug of the organization the project
                                          belongs to.

        :pparam string project_slug: the slug of the project.

        :auth: required
        """

        queryset = (
            EnvironmentProject.objects.filter(
                project=project,
                # Including the organization_id is necessary for postgres to use indexes
                # efficiently.
                environment__organization_id=project.organization_id,
            )
            .exclude(
                # HACK(mattrobenolt): We don't want to surface the
                # "No Environment" environment to the UI since it
                # doesn't really exist. This might very likely change
                # with new tagstore backend in the future, but until
                # then, we're hiding it since it causes more problems
                # than it's worth.
                environment__name=""
            )
            .select_related("environment")
            .order_by("environment__name")
        )

        visibility = request.GET.get("visibility", "visible")
        if visibility not in environment_visibility_filter_options:
            return Response(
                {
                    "detail": "Invalid value for 'visibility', valid values are: {!r}".format(
                        sorted(environment_visibility_filter_options.keys())
                    )
                },
                status=400,
            )

        add_visibility_filters = environment_visibility_filter_options[visibility]
        queryset = add_visibility_filters(queryset)

        return Response(serialize(list(queryset), request.user))

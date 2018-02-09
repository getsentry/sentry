from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Environment


environment_visibility_filter_options = {
    'all': lambda queryset: queryset,
    'hidden': lambda queryset: queryset.filter(environmentproject__is_hidden=True),
    'visible': lambda queryset: queryset.exclude(environmentproject__is_hidden=True),
}


class ProjectEnvironmentsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = Environment.objects.filter(
            projects=project,
            organization_id=project.organization_id,
        ).order_by('name')

        visibility = request.GET.get('visibility', 'visible')
        if visibility not in environment_visibility_filter_options:
            return Response({
                'detail': 'Invalid value for \'visibility\', valid values are: {!r}'.format(
                    environment_visibility_filter_options.keys(),
                ),
            }, status=400)

        add_visibility_filters = environment_visibility_filter_options[visibility]
        queryset = add_visibility_filters(queryset)

        return Response(serialize(list(queryset), request.user))

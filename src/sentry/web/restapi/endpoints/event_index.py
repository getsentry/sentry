from django.core.urlresolvers import reverse

from sentry.models import Project, Team
from sentry.web.frontend.groups import _get_group_list
from sentry.web.restapi.base import BaseView
from sentry.utils.http import absolute_uri
from sentry.utils.javascript import transform

from rest_framework.response import Response


class EventListView(BaseView):
    def get(self, request, team_slug, project_id):
        team = Team.objects.get_from_cache(slug=team_slug)
        project = Project.objects.get_from_cache(id=project_id)
        assert project.team_id == team.id
        project.team_cache = team

        offset = 0
        limit = 100

        response = _get_group_list(
            request=request,
            project=project,
        )

        group_list = response['event_list']
        group_list = list(group_list[offset:limit])

        # TODO: need to make a custom serializer
        results = transform(group_list, request)
        for group in results:
            group['uri'] = absolute_uri(reverse('sentry-api-1-event-details', args=(team.slug, project.slug, group['id'])))

        return Response(results)

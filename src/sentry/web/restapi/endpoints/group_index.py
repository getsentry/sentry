from django.core.urlresolvers import reverse
from django.utils.decorators import method_decorator

from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.web.restapi.base import BaseView
from sentry.utils.http import absolute_uri
from sentry.utils.javascript import transform

from rest_framework.response import Response


class GroupListView(BaseView):
    @method_decorator(has_access)
    def get(self, request, team, project):
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

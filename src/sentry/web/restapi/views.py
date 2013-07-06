from django.core.urlresolvers import reverse
from django.utils import timezone
from django.utils.decorators import method_decorator

from sentry.constants import STATUS_RESOLVED
from sentry.models import Activity, Group
from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.utils.http import absolute_uri
from sentry.utils.javascript import transform

from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework.response import Response

from .authentication import KeyAuthentication
from .permissions import HasProjectPermission


class BaseView(APIView):
    authentication_classes = (KeyAuthentication, SessionAuthentication)
    permission_classes = (HasProjectPermission,)


class EventListView(BaseView):
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


class EventDetailsView(BaseView):
    @method_decorator(has_access)
    def get(self, request, team, project, group_id):
        group = Group.objects.get(
            id=group_id,
            project=project,
        )

        return Response(transform(group, request))


class ResolveEventView(BaseView):
    @method_decorator(has_access)
    def post(self, request, team, project, group_id):
        group = Group.objects.get(
            id=group_id,
            project=project,
        )

        now = timezone.now()

        happened = Group.objects.filter(
            id=group.id,
        ).exclude(status=STATUS_RESOLVED).update(
            status=STATUS_RESOLVED,
            resolved_at=now,
        )
        group.status = STATUS_RESOLVED
        group.resolved_at = now

        if happened:
            Activity.objects.create(
                project=project,
                group=group,
                type=Activity.SET_RESOLVED,
                user=request.user,
            )

        return Response(transform(group, request))

from django.utils.decorators import method_decorator

from sentry.web.decorators import has_access
from sentry.web.frontend.groups import _get_group_list
from sentry.utils.javascript import transform

from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework.response import Response

from .authentication import KeyAuthentication
from .permissions import HasProjectPermission


class BaseView(APIView):
    authentication_classes = (KeyAuthentication, SessionAuthentication)
    permission_classes = (HasProjectPermission,)


class StreamView(BaseView):
    @method_decorator(has_access)
    def get(self, request, team, project):
        offset = 0
        limit = 100

        response = _get_group_list(
            request=request,
            project=project,
        )

        event_list = response['event_list']
        event_list = list(event_list[offset:limit])

        return Response(transform(event_list, request))

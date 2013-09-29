from django.utils.decorators import method_decorator

from sentry.models import Group
from sentry.web.decorators import has_access
from sentry.web.restapi.base import BaseView
from sentry.utils.javascript import transform

from rest_framework.response import Response


class EventDetailsView(BaseView):
    @method_decorator(has_access)
    def get(self, request, team, project, group_id):
        group = Group.objects.get(
            id=group_id,
            project=project,
        )

        return Response(transform(group, request))

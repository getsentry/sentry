from __future__ import absolute_import

from rest_framework.permissions import IsAuthenticated

from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Agent


class AgentIndexEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication, )
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        queryset = Agent.objects.all()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='agent_id',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

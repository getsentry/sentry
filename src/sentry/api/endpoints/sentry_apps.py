from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import SentryAppsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_apps import Creator
from sentry.models import SentryApp


class SentryAppsEndpoint(SentryAppsBaseEndpoint):
    @requires_feature('organizations:internal-catchall', any_org=True)
    def get(self, request):
        return self.paginate(
            request=request,
            queryset=SentryApp.visible_for_user(request.user),
            order_by='-date_added',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    @requires_feature('organizations:internal-catchall', any_org=True)
    def post(self, request, organization):
        serializer = SentryAppSerializer(data=request.json_body)

        if serializer.is_valid():
            result = serializer.object

            sentry_app = Creator.run(
                name=result.get('name'),
                organization=self._get_user_org(request),
                scopes=result.get('scopes'),
                events=result.get('events'),
                webhook_url=result.get('webhookUrl'),
                redirect_url=result.get('redirectUrl'),
                is_alertable=result.get('isAlertable'),
                overview=result.get('overview'),
            )

            return Response(serialize(sentry_app), status=201)

        return Response({'errors': serializer.errors}, status=422)

    def _get_user_org(self, request):
        return next(
            (
                org for org in request.user.get_orgs()
                if org.slug == request.json_body['organization']
            ),
            None,
        )

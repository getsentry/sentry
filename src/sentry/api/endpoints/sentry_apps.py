from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.auth.superuser import is_active_superuser
from sentry.api.bases import SentryAppsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.constants import SentryAppStatus
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_apps import Creator, InternalCreator
from sentry.models import SentryApp


class SentryAppsEndpoint(SentryAppsBaseEndpoint):
    def get(self, request):
        status = request.GET.get('status')

        if status == 'published':
            queryset = SentryApp.objects.filter(status=SentryAppStatus.PUBLISHED)

        elif status == 'unpublished':
            queryset = SentryApp.objects.filter(
                status=SentryAppStatus.UNPUBLISHED,
            )
            if not is_active_superuser(request):
                queryset = queryset.filter(
                    owner__in=request.user.get_orgs(),
                )
        elif status == 'internal':
            queryset = SentryApp.objects.filter(
                status=SentryAppStatus.INTERNAL,
            )
            if not is_active_superuser(request):
                queryset = queryset.filter(
                    owner__in=request.user.get_orgs(),
                )
        else:
            if is_active_superuser(request):
                queryset = SentryApp.objects.all()
            else:
                queryset = SentryApp.objects.filter(status=SentryAppStatus.PUBLISHED)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    @requires_feature('organizations:sentry-apps', any_org=True)
    def post(self, request, organization):
        data = {
            'name': request.json_body.get('name'),
            'user': request.user,
            'author': request.json_body.get('author'),
            'organization': self._get_user_org(request),
            'webhookUrl': request.json_body.get('webhookUrl'),
            'redirectUrl': request.json_body.get('redirectUrl'),
            'isAlertable': request.json_body.get('isAlertable'),
            'isInternal': request.json_body.get('isInternal'),
            'verifyInstall': request.json_body.get('verifyInstall'),
            'scopes': request.json_body.get('scopes', []),
            'events': request.json_body.get('events', []),
            'schema': request.json_body.get('schema', {}),
            'overview': request.json_body.get('overview'),
        }

        if self._has_hook_events(request) and not features.has('organizations:integrations-event-hooks',
                                                               organization,
                                                               actor=request.user):

            return Response({"non_field_errors": [
                "Your organization does not have access to the 'error' resource subscription.",
            ]}, status=403)

        serializer = SentryAppSerializer(data=data)

        if serializer.is_valid():
            data['redirect_url'] = data['redirectUrl']
            data['webhook_url'] = data['webhookUrl']
            data['is_alertable'] = data['isAlertable']
            data['verify_install'] = data['verifyInstall']

            creator = InternalCreator if data.get('isInternal') else Creator
            sentry_app = creator.run(request=request, **data)

            return Response(serialize(sentry_app), status=201)
        return Response(serializer.errors, status=400)

    def _get_user_org(self, request):
        return next(
            (
                org for org in request.user.get_orgs()
                if org.slug == request.json_body['organization']
            ),
            None,
        )

    def _has_hook_events(self, request):
        if not request.json_body.get('events'):
            return False

        return 'error' in request.json_body['events']

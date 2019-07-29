from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.mediators.sentry_apps import Updater, Destroyer


class SentryAppDetailsEndpoint(SentryAppBaseEndpoint):
    def get(self, request, sentry_app):
        if not features.has('organizations:sentry-apps',
                            sentry_app.owner,
                            actor=request.user):

            return Response(status=404)

        return Response(serialize(sentry_app, request.user))

    def put(self, request, sentry_app):
        if not features.has('organizations:sentry-apps',
                            sentry_app.owner,
                            actor=request.user):

            return Response(status=404)

        if self._has_hook_events(request) and not features.has('organizations:integrations-event-hooks',
                                                               sentry_app.owner,
                                                               actor=request.user):

            return Response({"non_field_errors": [
                "Your organization does not have access to the 'error' resource subscription.",
            ]}, status=403)

        serializer = SentryAppSerializer(
            sentry_app,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            result = serializer.validated_data

            updated_app = Updater.run(
                user=request.user,
                sentry_app=sentry_app,
                name=result.get('name'),
                author=result.get('author'),
                status=result.get('status'),
                webhook_url=result.get('webhookUrl'),
                redirect_url=result.get('redirectUrl'),
                is_alertable=result.get('isAlertable'),
                verify_install=result.get('verifyInstall'),
                scopes=result.get('scopes'),
                events=result.get('events'),
                schema=result.get('schema'),
                overview=result.get('overview'),
            )

            return Response(serialize(updated_app, request.user))
        return Response(serializer.errors, status=400)

    def delete(self, request, sentry_app):
        if not features.has('organizations:sentry-apps',
                            sentry_app.owner,
                            actor=request.user):
            return Response(status=404)

        if sentry_app.is_unpublished or sentry_app.is_internal:
            Destroyer.run(
                user=request.user,
                sentry_app=sentry_app,
                request=request,
            )
            return Response(status=204)

        return Response(
            {
                'detail': ['Published apps cannot be removed.']
            },
            status=403
        )

    def _has_hook_events(self, request):
        if not request.json_body.get('events'):
            return False

        return 'error' in request.json_body['events']

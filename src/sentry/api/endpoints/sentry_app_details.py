from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.constants import SentryAppStatus
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

        data = {
            'user': request.user,
            'sentry_app': sentry_app,
            'name': request.json_body.get('name'),
            'status': request.json_body.get('status'),
            'author': request.json_body.get('author'),
            'webhookUrl': request.json_body.get('webhookUrl'),
            'redirectUrl': request.json_body.get('redirectUrl'),
            'isAlertable': request.json_body.get('isAlertable'),
            'scopes': request.json_body.get('scopes'),
            'events': request.json_body.get('events'),
            'schema': request.json_body.get('schema'),
            'overview': request.json_body.get('overview'),
        }

        serializer = SentryAppSerializer(
            instance=sentry_app,
            data=data,
            partial=True,
        )

        if serializer.is_valid():
            result = serializer.object

            data['redirect_url'] = data['redirectUrl']
            data['webhook_url'] = data['webhookUrl']
            data['is_alertable'] = data['isAlertable']
            data['scopes'] = result.get('scopes')
            data['events'] = result.get('events')

            updated_app = Updater.run(**data)

            return Response(serialize(updated_app, request.user))
        return Response(serializer.errors, status=400)

    def delete(self, request, sentry_app):
        if not features.has('organizations:sentry-apps',
                            sentry_app.owner,
                            actor=request.user):
            return Response(status=404)

        if sentry_app.status == SentryAppStatus.UNPUBLISHED:
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

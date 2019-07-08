from __future__ import absolute_import

from rest_framework.response import Response

from sentry import options
from sentry import features
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.utils.email import send_mail
from sentry.utils import json


class SentryAppPublishRequestEndpoint(SentryAppBaseEndpoint):
    def put(self, request, sentry_app):
        if not features.has('organizations:sentry-apps',
                            sentry_app.owner,
                            actor=request.user):

            return Response(status=404)

        message = 'User %s of organization %s wants to publish %s' % (
            request.user, sentry_app.owner.slug, sentry_app.slug)

        print(message)

        send_mail(
            'Sentry App Publication Request',
            message,
            options.get('mail.from'),
            ['partners@sentry.io'],
            fail_silently=False
        )

        return Response(status=200)

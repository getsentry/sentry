from __future__ import absolute_import

from rest_framework.response import Response

from sentry import options
from sentry import features
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.utils import email


class SentryAppPublishRequestEndpoint(SentryAppBaseEndpoint):
    def post(self, request, sentry_app):
        if not features.has('organizations:sentry-apps',
                            sentry_app.owner,
                            actor=request.user):

            return Response(status=404)

        # check status of app to make sure it is unpublished
        if sentry_app.is_published:
            return Response({'detail': 'Cannot publish already published integration'}, status=400)

        if sentry_app.is_internal:
            return Response({'detail': 'Cannot publish internal integration'}, status=400)

        # For now, just send an email that a request to publish has been amde
        message = 'User %s of organization %s wants to publish %s' % (
            request.user.email, sentry_app.owner.slug, sentry_app.slug)

        email.send_mail(
            'Sentry App Publication Request',
            message,
            options.get('mail.from'),
            ['partners@sentry.io'],
            fail_silently=False
        )

        return Response(status=201)

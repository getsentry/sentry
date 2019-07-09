from __future__ import absolute_import

from rest_framework.response import Response

from sentry import options
from sentry import features
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.utils.email import send_mail


class SentryAppPublishRequestEndpoint(SentryAppBaseEndpoint):
    def post(self, request, sentry_app):
        if not features.has('organizations:sentry-apps',
                            sentry_app.owner,
                            actor=request.user):

            return Response(status=404)

        # For now, just send an email that a request to publish has been amde
        message = 'User %s of organization %s wants to publish %s' % (
            request.user.email, sentry_app.owner.slug, sentry_app.slug)

        send_mail(
            'Sentry App Publication Request',
            message,
            options.get('mail.from'),
            ['partners@sentry.io'],
            fail_silently=False
        )

        return Response(status=201)

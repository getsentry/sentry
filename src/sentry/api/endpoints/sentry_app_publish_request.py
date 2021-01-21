from __future__ import absolute_import

from rest_framework.response import Response

from sentry import options
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.utils import email
from sentry.mediators.sentry_apps import Updater
from sentry.constants import SentryAppStatus


class SentryAppPublishRequestEndpoint(SentryAppBaseEndpoint):
    def post(self, request, sentry_app):
        # check status of app to make sure it is unpublished
        if sentry_app.is_published:
            return Response({"detail": "Cannot publish already published integration."}, status=400)

        if sentry_app.is_internal:
            return Response({"detail": "Cannot publish internal integration."}, status=400)

        if sentry_app.is_publish_request_inprogress:
            return Response({"detail": "Publish request in progress."}, status=400)

        Updater.run(
            user=request.user,
            sentry_app=sentry_app,
            status=SentryAppStatus.PUBLISH_REQUEST_INPROGRESS_STR,
        )

        message = "User %s of organization %s wants to publish %s\n" % (
            request.user.email,
            sentry_app.owner.slug,
            sentry_app.slug,
        )

        for question_pair in request.data.get("questionnaire"):
            message += "\n\n>%s\n%s" % (question_pair["question"], question_pair["answer"])

        subject = "Sentry Integration Publication Request from %s" % sentry_app.owner.slug

        email.send_mail(
            subject,
            message,
            options.get("mail.from"),
            ["partners@sentry.io"],
            reply_to=[request.user.email],
        )

        return Response(status=201)

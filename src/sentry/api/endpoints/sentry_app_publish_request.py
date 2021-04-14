from rest_framework.response import Response

from sentry import options
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.constants import SentryAppStatus
from sentry.mediators.sentry_apps import Updater
from sentry.utils import email


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

        message = f"User {request.user.email} of organization {sentry_app.owner.slug} wants to publish {sentry_app.slug}\n"

        for question_pair in request.data.get("questionnaire"):
            message += "\n\n>{}\n{}".format(question_pair["question"], question_pair["answer"])

        subject = "Sentry Integration Publication Request from %s" % sentry_app.owner.slug

        email.send_mail(
            subject,
            message,
            options.get("mail.from"),
            ["partners@sentry.io"],
            reply_to=[request.user.email],
        )

        return Response(status=201)

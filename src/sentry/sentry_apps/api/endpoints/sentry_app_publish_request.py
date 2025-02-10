import logging
from collections.abc import Iterable

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.constants import SentryAppStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.sentry_apps.api.bases.sentryapps import COMPONENT_TYPES, SentryAppBaseEndpoint
from sentry.sentry_apps.logic import SentryAppUpdater
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar, SentryAppAvatarTypes
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.email import MessageBuilder

logger = logging.getLogger("sentry.sentry_apps.sentry_app_publish_request")


@control_silo_endpoint
class SentryAppPublishRequestEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def has_ui_component(self, sentry_app):
        """Determine if the sentry app supports issue linking or stack trace linking."""
        elements = (sentry_app.schema or {}).get("elements", [])
        return any(element.get("type") in COMPONENT_TYPES for element in elements)

    def post(self, request: Request, sentry_app) -> Response:
        # check status of app to make sure it is unpublished
        if sentry_app.is_published:
            return Response({"detail": "Cannot publish already published integration."}, status=400)

        if sentry_app.is_internal:
            return Response({"detail": "Cannot publish internal integration."}, status=400)

        if sentry_app.is_publish_request_inprogress:
            return Response({"detail": "Publish request in progress."}, status=400)

        if not SentryAppAvatar.objects.filter(
            sentry_app=sentry_app, color=True, avatar_type=SentryAppAvatarTypes.UPLOAD.value
        ).exists():
            return Response({"detail": "Must upload a logo for the integration."}, status=400)

        if (
            self.has_ui_component(sentry_app)
            and not SentryAppAvatar.objects.filter(
                sentry_app=sentry_app,
                color=False,
                avatar_type=SentryAppAvatarTypes.UPLOAD.value,
            ).exists()
        ):
            return Response(
                {"detail": "Must upload an icon for issue and stack trace linking integrations."},
                status=400,
            )

        assert isinstance(
            request.user, (User, RpcUser)
        ), "User must be authenticated to update a Sentry App"
        SentryAppUpdater(
            sentry_app=sentry_app,
            status=SentryAppStatus.PUBLISH_REQUEST_INPROGRESS_STR,
        ).run(user=request.user)

        org_mapping = OrganizationMapping.objects.filter(
            organization_id=sentry_app.owner_id
        ).first()
        org_slug = "<unknown>" if org_mapping is None else org_mapping.slug

        questionnaire: Iterable[dict[str, str]] = request.data.get("questionnaire", [])
        subject = "Your Sentry Integration Submission Confirmation"

        new_context = {
            "questionnaire": questionnaire,
            "actor": request.user,
            "sentry_app": sentry_app,
        }
        template = "sentry/emails/sentry-app-publish-confirmation.txt"
        html_template = "sentry/emails/sentry-app-publish-confirmation.html"

        message = MessageBuilder(
            subject=subject,
            context=new_context,
            template=template,
            html_template=html_template,
            type=type,
        )

        # Must send to user & partners so that the reply-to email will be each other
        recipients = ["partners@sentry.io", request.user.email]
        sent_messages = message.send(
            to=recipients,
        )
        # We sent an email to each person in the recip. list so anything less means we had a failure
        if sent_messages < len(recipients):
            logger.info("publish-email-failed", extra={"org_slug": org_slug, **new_context})
            return Response(
                {"detail": "Something went wrong trying to send publish confirmation email"},
                status=500,
            )

        return Response(status=201)

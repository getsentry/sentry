import logging
from collections.abc import Iterable

import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.constants import SentryAppStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.services.organization.service import organization_service
from sentry.sentry_apps.api.bases.sentryapps import COMPONENT_TYPES, SentryAppBaseEndpoint
from sentry.sentry_apps.logic import SentryAppUpdater
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar, SentryAppAvatarTypes
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import email
from sentry.utils.email.message_builder import MessageBuilder

logger = logging.getLogger("sentry.sentry_apps.sentry_app_publish_request")


class SentryAppPublishQuestionnaireSerializer(serializers.Serializer):
    question = serializers.CharField(required=True, allow_null=False)
    answer = serializers.CharField(required=True, allow_null=False)


class SentryAppPublishRequestSerializer(serializers.Serializer):
    questionnaire = SentryAppPublishQuestionnaireSerializer(many=True)


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
        if not org_mapping:
            return Response(
                {"detail": "Cannot publish a custom integration without an organization"},
                status=400,
            )
        organization = organization_service.get_organization_by_id(id=org_mapping.organization_id)
        message = f"User {request.user.email} of organization {org_mapping.slug} wants to publish {sentry_app.slug}\n"

        questionnaire_serializer = SentryAppPublishRequestSerializer(data=request.data)
        if not questionnaire_serializer.is_valid():
            return Response(questionnaire_serializer.errors, status=400)

        questionnaire: Iterable[dict[str, str]] = request.data.get("questionnaire", [])
        for question_pair in questionnaire:
            message += "\n\n>{}\n{}".format(
                question_pair.get("question", ""), question_pair.get("answer", "")
            )

        subject = "Sentry Integration Publication Request from %s" % org_mapping.slug

        assert organization is not None, "RpcOrganizationContext must exist to get the organization"
        if features.has(
            "organizations:streamlined-publishing-flow",
            organization.organization,
            actor=request.user,
        ):
            new_subject = f"We've received your integration submission for {sentry_app.slug}"
            new_context = {
                "questionnaire": questionnaire,
                "actor": request.user,
                "sentry_app": sentry_app,
                "organization": org_mapping,
            }

            template = "sentry/emails/sentry-app-publish-confirmation.txt"
            html_template = "sentry/emails/sentry-app-publish-confirmation.html"

            new_message = MessageBuilder(
                subject=new_subject,
                context=new_context,
                template=template,
                html_template=html_template,
                type="sentry-app-publish-request",
            )

            # Must send to user & partners so that the reply-to email will be each other
            recipients = ["partners@sentry.io", request.user.email]
            sent_messages = new_message.send(
                to=recipients,
            )
            # We sent an email to each person in the recip. list so anything less means we had a failure
            if sent_messages < len(recipients):
                extras = {"organization": org_mapping.slug, **new_context}
                sentry_sdk.capture_message("publish-email-failed", "info")
                logger.info("publish-email-failed", extra=extras)
                return Response(
                    {"detail": "Something went wrong trying to send publish confirmation email"},
                    status=500,
                )
        else:
            email.send_mail(
                subject,
                message,
                options.get("mail.from"),
                ["partners@sentry.io"],
                reply_to=[request.user.email],
            )

        return Response(status=201)

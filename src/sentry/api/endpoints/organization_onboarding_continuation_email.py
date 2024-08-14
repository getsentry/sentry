from rest_framework import serializers
from rest_framework.request import Request

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.utils.email import MessageBuilder
from sentry.utils.strings import oxfordize_list


class OnboardingContinuationSerializer(CamelSnakeSerializer):
    platforms = serializers.ListField(
        child=serializers.CharField(max_length=255),
    )


def get_request_builder_args(user: User, organization: Organization, platforms: list[str]):
    num_platforms = len(platforms)
    context = {
        "recipient_name": user.get_display_name(),
        "onboarding_link": organization.absolute_url(
            f"/onboarding/{organization.slug}/", query="referrer=onboarding_continuation-email"
        ),
        "organization_name": organization.name,
        "num_platforms": num_platforms,
        "platforms": oxfordize_list(platforms),
    }
    return {
        "subject": "Finish Onboarding",
        "type": "organization.onboarding-continuation-email",
        "context": context,
        "template": "sentry/emails/onboarding-continuation.txt",
        "html_template": "sentry/emails/onboarding-continuation.html",
    }


@region_silo_endpoint
class OrganizationOnboardingContinuationEmail(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    # let anyone in the org use this endpoint
    permission_classes = ()

    def post(self, request: Request, organization: Organization):
        serializer = OnboardingContinuationSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        msg = MessageBuilder(
            **get_request_builder_args(
                request.user, organization, serializer.validated_data["platforms"]
            )
        )
        msg.send_async([request.user.email])
        analytics.record(
            "onboarding_continuation.sent",
            organization_id=organization.id,
            user_id=request.user.id,
            providers="email",
        )
        return self.respond(status=202)

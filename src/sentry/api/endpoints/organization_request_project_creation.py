from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers

from sentry.api.bases.organization_request_change import OrganizationRequestChangeEndpoint
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri


class OrganizationRequestProjectCreationSerializer(CamelSnakeSerializer):
    target_user_email = serializers.EmailField(required=True)


class OrganizationRequestProjectCreation(OrganizationRequestChangeEndpoint):
    def post(self, request, organization):
        """
        Send an email requesting a project be created
        """

        serializer = OrganizationRequestProjectCreationSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        requester_name = request.user.get_display_name()
        requester_link = absolute_uri(
            f"/organizations/{organization.slug}/projects/new/?referrer=request_project&category=mobile"
        )

        subject = _("%s thinks Sentry can help monitor your mobile app")

        msg = MessageBuilder(
            subject=subject % (requester_name),
            template="sentry/emails/requests/organization-project.txt",
            html_template="sentry/emails/requests/organization-project.html",
            type="organization.project.request",
            context={
                "requester_name": requester_name,
                "requester_link": requester_link,
            },
        )

        msg.send_async([serializer.validated_data["target_user_email"]])

        return self.respond(status=201)

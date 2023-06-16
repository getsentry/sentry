from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import Organization, OrganizationMember, User
from sentry.notifications.notifications.organization_request.integration_request import (
    IntegrationRequestNotification,
)

from .mail import render_preview_email_for_notification


class DebugOrganizationIntegrationRequestEmailView(View):
    def get(self, request: Request) -> Response:
        org = Organization(id=1, slug="default", name="Default")
        requester = User(name="Rick Swan", actor_id=1)
        recipient = User(name="James Bond", actor_id=2)
        recipient_member = OrganizationMember(user_id=recipient.id, organization=org)

        notification = IntegrationRequestNotification(
            org,
            requester,
            provider_type="first_party",
            provider_slug="slack",
            provider_name="Slack",
        )

        # hack to avoid a query
        notification.role_based_recipient_strategy.set_member_in_cache(recipient_member)
        return render_preview_email_for_notification(notification, recipient)

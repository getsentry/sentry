from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.notifications.organization_request.integration_request import (
    IntegrationRequestNotification,
)
from sentry.users.models.user import User
from sentry.web.frontend.base import internal_region_silo_view

from .mail import render_preview_email_for_notification


@internal_region_silo_view
class DebugOrganizationIntegrationRequestEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        org = Organization(id=1, slug="default", name="Default")
        requester = User(name="Rick Swan")
        recipient = User(name="James Bond")
        recipient_member = OrganizationMember(user_id=recipient.id, organization=org)

        notification = IntegrationRequestNotification(
            org,
            requester,
            provider_type="first_party",
            provider_slug=IntegrationProviderSlug.SLACK.value,
            provider_name="Slack",
        )

        # hack to avoid a query
        notification.role_based_recipient_strategy.set_member_in_cache(recipient_member)
        return render_preview_email_for_notification(notification, recipient)

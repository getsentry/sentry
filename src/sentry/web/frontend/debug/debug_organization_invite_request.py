from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.notifications.notifications.organization_request import InviteRequestNotification
from sentry.users.models.user import User
from sentry.web.frontend.base import internal_region_silo_view

from .mail import render_preview_email_for_notification


@internal_region_silo_view
class DebugOrganizationInviteRequestEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        org = Organization(id=1, slug="default", name="Default")
        requester = User(name="Rick Swan", id=2, email="rick@gmail.com")
        OrganizationMember(user_id=requester.id, organization=org, email="james@gmail.com")
        pending_member = OrganizationMember(
            email="new_member@gmail.com",
            organization=org,
            inviter_id=requester.id,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        recipient = User(name="James Bond", id=3, email="james@gmail.com")
        recipient_member = OrganizationMember(
            user_id=recipient.id, organization=org, email="james@gmail.com"
        )

        notification = InviteRequestNotification(pending_member, requester)

        # hack to avoid a query
        notification.role_based_recipient_strategy.set_member_in_cache(recipient_member)
        return render_preview_email_for_notification(notification, recipient)

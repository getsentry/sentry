from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.user import User
from sentry.notifications.notifications.organization_request import JoinRequestNotification

from .mail import render_preview_email_for_notification


class DebugOrganizationJoinRequestEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        org = Organization(id=1, slug="default", name="Default")
        user_to_join = User(name="Rick Swan")
        pending_member = OrganizationMember(
            email="test@gmail.com",
            organization=org,
            user_id=user_to_join.id,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
        recipient = User(name="James Bond")
        recipient_member = OrganizationMember(user_id=recipient.id, organization=org)

        notification = JoinRequestNotification(pending_member, user_to_join)

        # hack to avoid a query
        notification.role_based_recipient_strategy.set_member_in_cache(recipient_member)
        return render_preview_email_for_notification(notification, recipient)

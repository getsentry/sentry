from django.http import HttpResponse
from django.urls import reverse
from rest_framework.request import Request

from sentry.models.organizationmember import OrganizationMember
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.web.frontend.base import control_silo_view

from .react_page import ReactPageView


@control_silo_view
class DisabledMemberView(ReactPageView):
    def is_member_disabled_from_limit(self, request: Request, organization):
        return False

    def handle(self, request: Request, organization, **kwargs) -> HttpResponse:
        user = request.user
        # if org member is not restricted, redirect user out of the disabled view
        try:
            member = organization_service.check_membership_by_id(
                user_id=user.id, organization_id=organization.id
            )
            if member and not member.flags["member-limit:restricted"]:
                return self.redirect(
                    reverse("sentry-organization-issue-list", args=[organization.slug])
                )
        except OrganizationMember.DoesNotExist:
            # this shouldn't happen but we can default to basic handling
            pass

        # otherwise, just do the basic handling
        return super().handle(request, organization, **kwargs)

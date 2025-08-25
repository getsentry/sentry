from django.http import HttpRequest, HttpResponse
from django.urls import reverse

from sentry.models.organizationmember import OrganizationMember
from sentry.organizations.services.organization import organization_service
from sentry.web.frontend.base import control_silo_view

from .react_page import ReactPageView


@control_silo_view
class DisabledMemberView(ReactPageView):
    def is_member_disabled_from_limit(self, request: object, organization):
        return False

    def handle(self, request: HttpRequest, organization, **kwargs) -> HttpResponse:
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

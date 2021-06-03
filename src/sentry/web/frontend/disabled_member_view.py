from django.urls import reverse

from sentry.auth.access import get_cached_organization_member
from sentry.models import OrganizationMember

from .react_page import ReactPageView


class DisabledMemberView(ReactPageView):
    def is_member_disabled_from_limit(self, request, organization):
        return False

    def handle(self, request, organization, **kwargs):
        user = request.user
        # if org member is not restricted, redirect user out of the disabled view
        try:
            member = get_cached_organization_member(user.id, organization.id)
            if not member.flags["member-limit:restricted"]:
                return self.redirect(
                    reverse("sentry-organization-issue-list", args=[organization.slug])
                )
        except OrganizationMember.DoesNotExist:
            # this shouldn't happen but we can default to basic handling
            pass

        # otherwise, just do the basic handling
        return super().handle(request, organization, **kwargs)

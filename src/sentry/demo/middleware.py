from django.conf import settings

from sentry.models import OrganizationMember
from sentry.utils import auth


class DemoMiddleware:
    # automatically log in logged out users when they land
    # on organization pages
    def process_view(self, request, view_func, view_args, view_kwargs):
        if not settings.DEMO_MODE:
            raise Exception("Demo mode misconfigured")

        # only handling org views
        if "organization_slug" not in view_kwargs:
            return

        org_slug = view_kwargs["organization_slug"]
        # if authed, make sure it's the same org
        if request.user.is_authenticated() and request.user.is_active:
            # if already part of org, then quit
            if OrganizationMember.objects.filter(
                organization__slug=org_slug, user=request.user
            ).exists():
                return

        # find a member in the target org
        try:
            member = OrganizationMember.objects.filter(
                organization__slug=org_slug, role="member"
            ).first()
            auth.login(request, member.user)
        except OrganizationMember.DoesNotExist:
            # TODO: render landing pagee
            pass

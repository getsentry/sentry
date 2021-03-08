from django.conf import settings

from sentry.models import OrganizationMember
from sentry.utils import auth


class DemoMiddleware:
    # automatically log in logged out users when they land
    # on organization pages
    def process_view(self, request, view_func, view_args, view_kwargs):
        if not settings.DEMO_MODE:
            return

        # only handling org views
        if "organization_slug" not in view_kwargs:
            return

        # if authed, no action required
        if request.user.is_authenticated() and request.user.is_active:
            return

        org_slug = view_kwargs["organization_slug"]
        try:
            member = OrganizationMember.objects.filter(
                organization__slug=org_slug, role="member"
            ).first()
            auth.login(request, member.user)
        except OrganizationMember.DoesNotExist:
            # TODO: render landing pagee
            pass

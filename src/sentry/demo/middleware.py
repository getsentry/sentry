from django.conf import settings
from django.core.urlresolvers import reverse
from django.http import JsonResponse

from sentry.models import OrganizationMember
from sentry.utils import auth

prompt_route = reverse("sentry-api-0-prompts-activity")
org_creation_route = reverse("sentry-api-0-organizations")


class DemoMiddleware:
    def process_view(self, request, view_func, view_args, view_kwargs):
        if not settings.DEMO_MODE:
            raise Exception("Demo mode misconfigured")

        # always return dismissed if we are in demo mode
        if request.path == prompt_route:
            return JsonResponse({"data": {"dismissed_ts": 1}}, status=200)

        # disable org creation
        if request.path == org_creation_route and request.method == "POST":
            return JsonResponse(
                {"detail": "Organization creation disabled in demo mode"}, status=400
            )

        # only handling org views
        if "organization_slug" not in view_kwargs:
            return

        # automatically log in logged out users when they land
        # on organization pages

        org_slug = view_kwargs["organization_slug"]
        # if authed, make sure it's the same org
        if request.user.is_authenticated() and request.user.is_active:
            # if already part of org, then quit
            if OrganizationMember.objects.filter(
                organization__slug=org_slug, user=request.user
            ).exists():
                return

        # find a member in the target org
        member = OrganizationMember.objects.filter(
            organization__slug=org_slug, role="member"
        ).first()
        # if no member, can't login
        if not member or not member.user:
            return
        auth.login(request, member.user)

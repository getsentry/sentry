from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse
from django.urls import reverse

from sentry.models import OrganizationMember
from sentry.utils import auth

prompt_route = reverse("sentry-api-0-prompts-activity")
org_creation_route = reverse("sentry-api-0-organizations")
login_route = reverse("sentry-login")

# redirect to the sandbox page
login_redirect_route = "https://sentry.io/demo/sandbox/"


class DemoMiddleware:
    def process_view(self, request, view_func, view_args, view_kwargs):
        if not settings.DEMO_MODE:
            raise Exception("Demo mode misconfigured")

        path = request.path
        method = request.method

        # always return dismissed if we are in demo mode
        if path == prompt_route:
            return JsonResponse({"data": {"dismissed_ts": 1}}, status=200)

        # disable org creation
        if path == org_creation_route and method == "POST":
            return JsonResponse(
                {"detail": "Organization creation disabled in demo mode"}, status=400
            )

        # at this point, don't care about any API routes
        if path.startswith("/api/"):
            return

        # backdoor to allow logins
        disable_login = request.GET.get("allow_login") != "1"
        # don't want people to see the login page in demo mode
        if path == login_route and disable_login and method == "GET":
            return HttpResponseRedirect(login_redirect_route)

        # org routes only below
        if "organization_slug" not in view_kwargs:
            return

        # don't want people to see the login page in demo mode
        org_login_path = reverse(
            "sentry-auth-organization", args=[view_kwargs["organization_slug"]]
        )
        if path == org_login_path and disable_login and method == "GET":
            return HttpResponseRedirect(login_redirect_route)

        # automatically log in logged out users when they land
        # on organization pages

        org_slug = view_kwargs["organization_slug"]
        # if authed, make sure it's the same org
        if request.user.is_authenticated and request.user.is_active:
            # if already part of org, then quit
            if OrganizationMember.objects.filter(
                organization__slug=org_slug, user=request.user
            ).exists():
                return

        # find a member in the target org
        member = OrganizationMember.objects.filter(
            organization__slug=org_slug, user__demouser__isnull=False, role="member"
        ).first()
        # if no member, can't login
        if not member or not member.user:
            return
        auth.login(request, member.user)

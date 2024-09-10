from django.http import HttpRequest

from sentry.web.frontend.base import ProjectView, region_silo_view


@region_silo_view
class LoginSuccessView(ProjectView):
    def handle_permission_required(self, request: HttpRequest, organization, *args, **kwargs):
        # If already authenticated, don't redirect to login.
        self.default_context = {}
        return self.respond("sentry/toolbar/missing-perms.html", status=403)

    def get(self, request: HttpRequest, organization, project):
        return self.respond("sentry/toolbar/login-success.html", status=200)

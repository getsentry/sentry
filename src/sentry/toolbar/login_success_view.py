from django.http import HttpRequest, HttpResponse

from sentry.web.frontend.base import OrganizationView, region_silo_view


@region_silo_view
class LoginSuccessView(OrganizationView):
    def handle_permission_required(self, request: HttpRequest, organization, *args, **kwargs):
        # If already authenticated, don't redirect to login.
        return HttpResponse(status=403)

    def get(self, request: HttpRequest, organization, project_id_or_slug):
        return self.respond("sentry/toolbar/login-success.html", status=200)

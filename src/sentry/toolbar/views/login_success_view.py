from django.http import HttpRequest

from sentry.auth.user_jwt import UserJWTToken
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.web.frontend.base import ProjectView, region_silo_view

TEMPLATE = "sentry/toolbar/login-success.html"


@region_silo_view
class LoginSuccessView(ProjectView):
    def get(
        self, request: HttpRequest, organization: Organization, project: Project, *args, **kwargs
    ):
        return self.respond(
            TEMPLATE,
            status=200,
            context={
                "delay": int(request.GET.get("delay", 3000)),
                "token": UserJWTToken.from_request(request, self.default_context),
            },
        )


3

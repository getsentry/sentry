from sentry.web.frontend.base import BaseView


class LoginSuccessView(BaseView):
    def get(self, request, organization_slug, project_slug):
        return self.respond("sentry/toolbar/login_success.html")

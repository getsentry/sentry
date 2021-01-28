from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request):
        return self.redirect_to_org(request)

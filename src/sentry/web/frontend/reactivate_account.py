from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.request import Request

from sentry.services.hybrid_cloud.user.service import user_service
from sentry.utils import auth
from sentry.web.frontend.base import BaseView, control_silo_view


@control_silo_view
class ReactivateAccountView(BaseView):
    # auth check is managed by view code
    auth_required = False

    @method_decorator(never_cache)
    def handle(self, request: Request) -> HttpResponseBase:
        if not request.user.is_authenticated:
            return self.handle_auth_required(request)

        if request.POST.get("op") == "confirm":
            user_service.update_user(user_id=request.user.id, attrs=dict(is_active=True))

            return self.redirect(auth.get_login_redirect(request))

        context = {}
        return self.respond("sentry/reactivate-account.html", context)

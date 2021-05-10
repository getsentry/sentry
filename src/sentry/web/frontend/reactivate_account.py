from django.db import transaction
from django.views.decorators.cache import never_cache

from sentry.utils import auth
from sentry.web.frontend.base import BaseView


class ReactivateAccountView(BaseView):
    # auth check is managed by view code
    auth_required = False

    @never_cache
    @transaction.atomic
    def handle(self, request):
        if not request.user.is_authenticated:
            return self.handle_auth_required(request)

        if request.POST.get("op") == "confirm":
            request.user.update(is_active=True)

            return self.redirect(auth.get_login_redirect(request))

        context = {}
        return self.respond("sentry/reactivate-account.html", context)

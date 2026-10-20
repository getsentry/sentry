from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect

from sentry import options
from sentry.users.models.authenticator import Authenticator
from sentry.utils import auth, json
from sentry.web.frontend.base import BaseView, control_silo_view


@control_silo_view
class TwoFactorAuthView(BaseView):
    auth_required = False

    def handle(self, request: HttpRequest) -> HttpResponse:
        user = auth.get_pending_2fa_user(request)
        if user is not None and not Authenticator.objects.all_interfaces_for_user(user):
            if auth.login(request, user, passed_2fa=True):
                return HttpResponseRedirect(auth.get_login_redirect(request))

        return HttpResponseRedirect(auth.get_login_url())


@control_silo_view
def u2f_appid(request):
    facets = settings.SENTRY_U2F_FACETS
    if not facets:
        facets = [options.get("system.url-prefix")]
    return HttpResponse(
        json.dumps(
            {
                "trustedFacets": [
                    {"version": {"major": 1, "minor": 0}, "ids": [x.rstrip("/") for x in facets]}
                ]
            }
        ),
        content_type="application/fido.trusted-apps+json",
    )

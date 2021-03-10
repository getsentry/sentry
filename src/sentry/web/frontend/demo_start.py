from django.http import Http404
from django.conf import settings
from django.db import transaction

from sentry.demo.utils import NoDemoOrgReady
from sentry.utils import auth
from sentry.web.frontend.base import BaseView


class DemoStartView(BaseView):
    csrf_protect = False
    auth_required = False

    @transaction.atomic
    def post(self, request):
        # need this check for tests since the route will exist even if DEMO_MODE=False
        if not settings.DEMO_MODE:
            raise Http404

        # move this import here so we Django doesn't discover the models
        # for demo mode except when Demo mode is actually active
        from sentry.demo.demo_org_manager import assign_demo_org

        # assign the demo org and get the user
        try:
            _, user = assign_demo_org()
        except NoDemoOrgReady:
            # TODO: handle NoDemoOrgReady error
            raise

        auth.login(request, user)

        resp = self.redirect(auth.get_login_redirect(request))
        # set a cookie of whether the user accepteed tracking so we know
        # whether to initialize analytics when accepted_tracking=1
        resp.set_cookie("accepted_tracking", request.POST.get("accepted_tracking"))

        return resp

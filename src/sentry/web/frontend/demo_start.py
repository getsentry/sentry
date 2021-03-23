import logging

from django.http import Http404
from django.conf import settings

from sentry.utils import auth
from sentry.web.frontend.base import BaseView

logger = logging.getLogger(__name__)


class DemoStartView(BaseView):
    csrf_protect = False
    auth_required = False

    def post(self, request):
        # need this check for tests since the route will exist even if DEMO_MODE=False
        if not settings.DEMO_MODE:
            raise Http404

        logger.info("post.start")

        # move this import here so we Django doesn't discover the models
        # for demo mode except when Demo mode is actually active
        from sentry.demo.demo_org_manager import assign_demo_org

        # assign the demo org and get the user
        org, user = assign_demo_org()

        logger.info("post.assigned_org", extra={"organization_slug": org.slug})

        auth.login(request, user)

        resp = self.redirect(auth.get_login_redirect(request))
        # set a cookie of whether the user accepteed tracking so we know
        # whether to initialize analytics when accepted_tracking=1
        # 0 means don't show the footer to accept cookies (user already declined)
        # no value means we show the footer to accept cookies (user has neither accepted nor declined)
        accepted_tracking = request.POST.get("accepted_tracking")
        if accepted_tracking in ["0", "1"]:
            resp.set_cookie("accepted_tracking", accepted_tracking)

        return resp

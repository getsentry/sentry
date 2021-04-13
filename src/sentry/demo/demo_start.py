import logging

import sentry_sdk
from django.conf import settings
from django.http import Http404

from sentry.models import OrganizationMember, OrganizationStatus
from sentry.utils import auth
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView

logger = logging.getLogger(__name__)

ACCEPTED_TRACKING_COOKIE = "accepted_tracking"
MEMBER_ID_COOKIE = "demo_member_id"


class DemoStartView(BaseView):
    csrf_protect = False
    auth_required = False

    @transaction_start("DemoStartView")
    def post(self, request):
        # double check DEMO_MODE is disabled
        if not settings.DEMO_MODE:
            raise Http404

        org = None
        # see if the user already was assigned a member
        member_id = request.get_signed_cookie(MEMBER_ID_COOKIE, default="")
        logger.info("post.start", extra={"cookie_member_id": member_id})
        sentry_sdk.set_tag("member_id", member_id)

        skip_buffer = request.POST.get("skip_buffer") == "1"
        sentry_sdk.set_tag("skip_buffer", skip_buffer)

        if member_id and not skip_buffer:
            try:
                # only assign them to an active org for a member role
                member = OrganizationMember.objects.get(
                    id=member_id, organization__status=OrganizationStatus.ACTIVE, role="member"
                )
            except OrganizationMember.DoesNotExist:
                pass
            else:
                org = member.organization
                user = member.user
                logger.info("post.retrieved_user", extra={"organization_slug": org.slug})

        if not org:
            # move this import here so we Django doesn't discover the models
            # for demo mode except when Demo mode is actually active
            from .demo_org_manager import assign_demo_org

            # assign the demo org and get the user
            org, user = assign_demo_org(skip_buffer=skip_buffer)
            member = OrganizationMember.objects.get(organization=org, user=user)

            logger.info("post.assigned_org", extra={"organization_slug": org.slug})

        auth.login(request, user)
        resp = self.redirect(get_redirect_url(request, org))

        # set a cookie of whether the user accepteed tracking so we know
        # whether to initialize analytics when accepted_tracking=1
        # 0 means don't show the footer to accept cookies (user already declined)
        # no value means we show the footer to accept cookies (user has neither accepted nor declined)
        accepted_tracking = request.POST.get(ACCEPTED_TRACKING_COOKIE)
        if accepted_tracking in ["0", "1"]:
            resp.set_cookie(ACCEPTED_TRACKING_COOKIE, accepted_tracking)

        # set the member id
        resp.set_signed_cookie(MEMBER_ID_COOKIE, member.id)
        return resp


def get_redirect_url(request, org):
    # determine the redirect based on the scenario
    scenario = request.POST.get("scenario")
    if scenario == "performance":
        return f"/organizations/{org.slug}/performance/"
    if scenario == "releases":
        return f"/organizations/{org.slug}/releases/"
    if scenario == "alerts":
        return f"/organizations/{org.slug}/alerts/"
    if scenario == "discover":
        return f"/organizations/{org.slug}/discover/queries/"
    if scenario == "dashboards":
        return f"/organizations/{org.slug}/dashboards/"
    url = auth.get_login_redirect(request)
    # user is logged in so will be automatically redirected
    # after landing on login page
    url += "?allow_login=1"
    return url

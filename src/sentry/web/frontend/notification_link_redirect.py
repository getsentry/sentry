from __future__ import annotations

import logging
import re

from django.core.cache import cache
from django.http import Http404, HttpRequest, HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.views.generic import View

from sentry.notifications.platform.tracking import (
    NotificationEngagementMechanism,
    NotificationLink,
    PullRequestRedirect,
    is_tracking_enabled,
    parse_pull_request_redirect,
    record_engagement,
)
from sentry.utils.hashlib import md5_text
from sentry.web.frontend.base import control_silo_view

logger = logging.getLogger(__name__)

# Clicks on the same link by the same person are only recorded once every 10 minutes.
_CLICK_DEDUPE_SECONDS = 10 * 60

# Link scanners and preview bots in email clients and chat apps fetch links without a person
# clicking them.
_AUTOMATED_USER_AGENT = re.compile(
    r"bot\b|crawler|spider|preview|slack-imgproxy|facebookexternalhit|whatsapp|microsoft office"
    r"|proofpoint|mimecast|barracuda|python-requests|curl/|wget/|go-http-client",
    re.IGNORECASE,
)


@control_silo_view
class NotificationLinkRedirectView(View):
    """
    Redirects a notification's link to a GitHub pull request, recording the click. Clicks on
    links to other sites otherwise never reach Sentry. The link's token is signed, so only links
    that Sentry sent are followed and this can't be used as an open redirect.
    """

    def get(self, request: HttpRequest, token: str) -> HttpResponseBase:
        redirect = parse_pull_request_redirect(token)
        if redirect is None:
            raise Http404

        try:
            _record_click(request, redirect)
        except Exception:
            logger.exception("notifications.tracking.redirect.failed")
        return HttpResponseRedirect(redirect.url)


def _record_click(request: HttpRequest, redirect: PullRequestRedirect) -> None:
    context = redirect.context
    if (
        request.method != "GET"
        or not context.notification_uuid
        or not is_tracking_enabled(context.source, context.provider)
    ):
        return

    user_agent = request.META.get("HTTP_USER_AGENT", "")
    if not user_agent or _AUTOMATED_USER_AGENT.search(user_agent):
        return

    user = getattr(request, "user", None)
    user_id = user.id if user is not None and user.is_authenticated else None
    # Without a login, the client's address stands in for the person.
    clicker = user_id if user_id is not None else request.META.get("REMOTE_ADDR")
    dedupe_key = (
        "notifications.tracking.redirect:"
        f"{md5_text(context.notification_uuid, redirect.url, clicker).hexdigest()}"
    )
    if not cache.add(dedupe_key, True, _CLICK_DEDUPE_SECONDS):
        return

    record_engagement(
        context,
        mechanism=NotificationEngagementMechanism.REDIRECT,
        link=NotificationLink.PULL_REQUEST,
        user_id=user_id,
    )

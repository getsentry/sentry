from __future__ import annotations

import logging
import re
from typing import Literal

from django.core.cache import cache
from django.http import Http404, HttpRequest, HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.generic import View

from sentry.notifications.platform.tracking import (
    NotificationEngagementMechanism,
    PullRequestRedirect,
    classify_link,
    is_tracking_enabled,
    parse_pull_request_redirect,
    record_engagement,
)
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text
from sentry.web.decorators import ai_machine_readable
from sentry.web.frontend.base import control_silo_view

logger = logging.getLogger(__name__)

# Clicks on the same link by the same person are only recorded once every 10 minutes.
_CLICK_DEDUPE_SECONDS = 10 * 60

_RedirectOutcome = Literal[
    "invalid_token", "untracked", "automated", "duplicate", "recorded", "failed"
]

# Link scanners and preview bots in email clients and chat apps fetch links without a person
# clicking them.
_AUTOMATED_USER_AGENT = re.compile(
    r"bot\b|crawler|spider|preview|slack-imgproxy|facebookexternalhit|whatsapp|microsoft office"
    r"|proofpoint|mimecast|barracuda|python-requests|curl/|wget/|go-http-client",
    re.IGNORECASE,
)


@control_silo_view
# Agents that ask for Markdown would otherwise get Sentry's web UI guidance instead of the PR.
@ai_machine_readable
class NotificationLinkRedirectView(View):
    """
    Redirects a notification's link to a GitHub pull request, recording the click. Clicks on
    links to other sites otherwise never reach Sentry. The link's token is signed, so only links
    that Sentry sent are followed and this can't be used as an open redirect.
    """

    # A cached redirect would send repeat clicks straight to GitHub without being counted.
    @method_decorator(never_cache)
    def get(self, request: HttpRequest, token: str) -> HttpResponseBase:
        redirect = parse_pull_request_redirect(token)
        if redirect is None:
            # A rise in invalid tokens means links Sentry sent are breaking, such as when cells
            # and control sign with different secret keys.
            _record_outcome("invalid_token")
            raise Http404

        outcome: _RedirectOutcome
        try:
            outcome = _record_click(request, redirect)
        except Exception:
            logger.exception("notifications.tracking.redirect.failed")
            outcome = "failed"
        _record_outcome(outcome)
        return HttpResponseRedirect(redirect.url)


def _record_outcome(outcome: _RedirectOutcome) -> None:
    metrics.incr("notifications.tracking.redirect", tags={"outcome": outcome}, sample_rate=1.0)


def _record_click(request: HttpRequest, redirect: PullRequestRedirect) -> _RedirectOutcome:
    context = redirect.context
    if (
        request.method != "GET"
        or not context.notification_uuid
        or not is_tracking_enabled(context.source, context.provider)
    ):
        return "untracked"

    user_agent = request.META.get("HTTP_USER_AGENT", "")
    if not user_agent or _AUTOMATED_USER_AGENT.search(user_agent):
        return "automated"

    user = getattr(request, "user", None)
    user_id = user.id if user is not None and user.is_authenticated else None
    # Without a login, the client's address stands in for the person.
    clicker = user_id if user_id is not None else request.META.get("REMOTE_ADDR")
    dedupe_key = (
        "notifications.tracking.redirect:"
        f"{md5_text(context.notification_uuid, redirect.url, clicker).hexdigest()}"
    )
    if not cache.add(dedupe_key, True, _CLICK_DEDUPE_SECONDS):
        return "duplicate"

    record_engagement(
        context,
        mechanism=NotificationEngagementMechanism.REDIRECT,
        link=classify_link(redirect.url),
        user_id=user_id,
    )
    return "recorded"

from __future__ import annotations

import logging
import re
from urllib.parse import urlsplit

from django.core.cache import cache
from django.http import Http404, HttpRequest, HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.views.generic import View

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.notifications.platform.tracking import (
    PULL_REQUEST_PATH,
    NotificationEngagementMechanism,
    NotificationLink,
    NotificationTrackingContext,
    is_tracking_enabled,
    parse_referrer,
    record_engagement,
)
from sentry.utils.hashlib import md5_text
from sentry.web.frontend.base import cell_silo_view

logger = logging.getLogger(__name__)

_GITHUB_PROVIDERS = ("integrations:github", "integrations:github_enterprise")

# Clicks on the same link by the same person are only recorded once every 10 minutes.
_CLICK_DEDUPE_SECONDS = 10 * 60

# Link scanners and preview bots in email clients and chat apps fetch links without a person
# clicking them.
_AUTOMATED_USER_AGENT = re.compile(
    r"bot\b|crawler|spider|preview|slack-imgproxy|facebookexternalhit|whatsapp|microsoft office"
    r"|proofpoint|mimecast|barracuda|python-requests|curl/|wget/|go-http-client",
    re.IGNORECASE,
)


@cell_silo_view
class NotificationLinkRedirectView(View):
    """
    Redirects a notification's link to a pull request, recording the click. Clicks on links to
    other sites otherwise never reach Sentry. Only pull requests on the organization's connected
    GitHub repositories are followed, so this can't be used as an open redirect.
    """

    def get(
        self, request: HttpRequest, organization_slug: str, destination: str
    ) -> HttpResponseBase:
        try:
            organization = Organization.objects.get_from_cache(slug=organization_slug)
        except Organization.DoesNotExist:
            raise Http404

        pull_request_url = _get_pull_request_url(organization, destination)
        if pull_request_url is None:
            raise Http404

        try:
            _record_click(request, organization, pull_request_url)
        except Exception:
            logger.exception("notifications.tracking.redirect.failed")
        return HttpResponseRedirect(pull_request_url)


def _get_pull_request_url(organization: Organization, destination: str) -> str | None:
    """
    Returns the URL of the pull request that `destination`, a URL without its scheme, names when
    it's on one of the organization's active GitHub repositories.
    """
    host, _, path = destination.partition("/")
    match = PULL_REQUEST_PATH.match(f"/{path}")
    if not host or match is None:
        return None

    repository_urls = Repository.objects.filter(
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
        provider__in=_GITHUB_PROVIDERS,
        name__iexact=match["repository"],
    ).values_list("url", flat=True)
    for repository_url in repository_urls:
        if not repository_url:
            continue
        parsed = urlsplit(repository_url)
        if (
            parsed.netloc.lower() == host.lower()
            and parsed.path.strip("/").lower() == match["repository"].lower()
        ):
            return f"{repository_url.rstrip('/')}/pull/{match['number']}"
    return None


def _record_click(request: HttpRequest, organization: Organization, pull_request_url: str) -> None:
    referrer = parse_referrer(request.GET.get("referrer", ""))
    notification_uuid = request.GET.get("notification_uuid")
    if (
        request.method != "GET"
        or referrer is None
        or not notification_uuid
        or not is_tracking_enabled(referrer.source, referrer.provider)
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
        f"{md5_text(notification_uuid, pull_request_url, clicker).hexdigest()}"
    )
    if not cache.add(dedupe_key, True, _CLICK_DEDUPE_SECONDS):
        return

    record_engagement(
        NotificationTrackingContext(
            source=referrer.source,
            provider=referrer.provider,
            category=referrer.category,
            notification_uuid=notification_uuid,
            organization_id=organization.id,
        ),
        mechanism=NotificationEngagementMechanism.REDIRECT,
        link=NotificationLink.PULL_REQUEST,
        user_id=user_id,
    )

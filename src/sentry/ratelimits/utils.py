from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Mapping

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import Endpoint
from sentry.types.ratelimit import RateLimit
from sentry.utils.hashlib import md5_text

from . import backend as ratelimiter

if TYPE_CHECKING:
    from sentry.models import ApiToken, Organization, User

# TODO(mgaeta): It's not currently possible to type a Callable's args with kwargs.
EndpointFunction = Callable[..., Response]

DEFAULT_CONFIG = {
    # 100 invites from a user per day
    "members:invite-by-user": {"limit": 100, "window": 3600 * 24},
    # 100 invites from an org per day
    "members:invite-by-org": {"limit": 100, "window": 3600 * 24},
    # 10 invites per email per org per day
    "members:org-invite-to-email": {"limit": 10, "window": 3600 * 24},
}


def can_be_ratelimited(request: Request, view_func: EndpointFunction) -> bool:
    return hasattr(view_func, "view_class") and not request.path_info.startswith(
        settings.ANONYMOUS_STATIC_PREFIXES
    )


def get_rate_limit_key(view_func: EndpointFunction, request: Request) -> str | None:
    """Construct a consistent global rate limit key using the arguments provided"""

    view = view_func.__qualname__
    http_method = request.method

    # This avoids touching user session, which means we avoid
    # setting `Vary: Cookie` as a response header which will
    # break HTTP caching entirely.
    if request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES):
        return None

    request_user = getattr(request, "user", None)
    user_id = getattr(request_user, "id", None)
    is_sentry_app = getattr(request_user, "is_sentry_app", None)

    request_access = getattr(request, "access", None)
    org_id = getattr(request_access, "organization_id", None)

    ip_address = request.META.get("REMOTE_ADDR")

    if is_sentry_app and org_id is not None:
        category = "org"
        id = org_id
    elif user_id is not None:
        category = "user"
        id = user_id
    elif ip_address is not None:
        category = "ip"
        id = ip_address
    # If IP address doesn't exist, skip ratelimiting for now
    else:
        return None
    return f"{category}:{view}:{http_method}:{id}"


def get_rate_limit_value(http_method: str, endpoint: Endpoint, category: str) -> RateLimit | None:
    """
    Read the rate limit from the view function to be used for the rate limit check
    """
    rate_limit_lookup_dict = getattr(endpoint, "rate_limits", None)

    # If the endpoint doesn't have a rate limit property, then it isn't a
    # subclass to our Endpoint it should not be rate limited.
    if rate_limit_lookup_dict is None:
        return None
    rate_limits = rate_limit_lookup_dict.get(http_method, settings.SENTRY_RATELIMITER_DEFAULTS)
    return rate_limits.get(category, settings.SENTRY_RATELIMITER_DEFAULTS[category])


def above_rate_limit_check(key: str, rate_limit: RateLimit) -> Mapping[str, bool | int]:
    is_limited, current = ratelimiter.is_limited_with_value(
        key, limit=rate_limit.limit, window=rate_limit.window
    )
    return {
        "is_limited": is_limited,
        "current": current,
        "limit": rate_limit.limit,
        "window": rate_limit.window,
    }


def for_organization_member_invite(
    organization: Organization,
    email: str,
    user: User | None = None,
    auth: ApiToken | None = None,
    config: Mapping[str, Any] | None = None,
) -> bool:
    """
    Rate limit logic for triggering a user invite email, which should also be
    applied for generating a brand new member invite when possible.
    """
    if config is None:
        config = DEFAULT_CONFIG

    if not features.has("organizations:invite-members-rate-limits", organization, actor=user):
        return False

    return any(
        (
            ratelimiter.is_limited(
                "members:invite-by-user:{}".format(
                    md5_text(user.id if user and user.is_authenticated else str(auth)).hexdigest()
                ),
                **config["members:invite-by-user"],
            )
            if (user or auth)
            else None,
            ratelimiter.is_limited(
                f"members:invite-by-org:{md5_text(organization.id).hexdigest()}",
                **config["members:invite-by-org"],
            ),
            ratelimiter.is_limited(
                "members:org-invite-to-email:{}-{}".format(
                    organization.id, md5_text(email.lower()).hexdigest()
                ),
                **config["members:org-invite-to-email"],
            ),
        )
    )

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Mapping, Type

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.types.ratelimit import RateLimit, RateLimitCategory, RateLimitMeta
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

    ip_address = request.META.get("REMOTE_ADDR")
    request_auth = getattr(request, "auth", None)
    request_user = getattr(request, "user", None)

    from django.contrib.auth.models import AnonymousUser

    from sentry.auth.system import SystemToken
    from sentry.models import ApiKey, ApiToken

    # Don't Rate Limit System Token Requests
    if isinstance(request_auth, SystemToken):
        return None

    if isinstance(request_auth, ApiToken):

        if request_user.is_sentry_app:
            category = "org"
            id = get_organization_id_from_token(request_auth.id)
        else:
            category = "user"
            id = request_auth.user_id

    elif (
        not isinstance(request_auth, ApiKey)
        and request_user
        and not isinstance(request_user, AnonymousUser)
    ):
        category = "user"
        id = request_user.id

    # ApiKeys will be treated with IP ratelimits
    elif ip_address is not None:
        category = "ip"
        id = ip_address

    # If IP address doesn't exist, skip ratelimiting for now
    else:
        return None
    return f"{category}:{view}:{http_method}:{id}"


def get_organization_id_from_token(token_id: str) -> int | None:
    from sentry.models import SentryAppInstallation

    installation = SentryAppInstallation.objects.get_by_api_token(token_id).first()
    return installation.organization_id if installation else None


def get_rate_limit_value(
    http_method: str, endpoint: Type[object], category: RateLimitCategory
) -> RateLimit | None:
    """Read the rate limit from the view function to be used for the rate limit check."""
    found_endpoint_class = False
    seen_classes = {endpoint}
    classes_queue = [endpoint]
    while len(classes_queue) > 0:
        next_class = classes_queue.pop(0)
        rate_limit_lookup_dict = getattr(next_class, "rate_limits", None)
        if rate_limit_lookup_dict is not None:
            found_endpoint_class = True
        else:
            rate_limit_lookup_dict = {}
        ratelimits_by_category = rate_limit_lookup_dict.get(http_method, {})
        ratelimit_option = ratelimits_by_category.get(category)
        if ratelimit_option:
            return ratelimit_option

        # Everything will eventually hit `object`, which has no __bases__.
        for klass in next_class.__bases__:
            # Short-circuit for diamond inheritance.
            if klass not in seen_classes:
                classes_queue.append(klass)
                seen_classes.add(klass)

    if not found_endpoint_class:
        return None
    return settings.SENTRY_RATELIMITER_DEFAULTS[category]


def above_rate_limit_check(key: str, rate_limit: RateLimit) -> RateLimitMeta:
    is_limited, current, reset_time = ratelimiter.is_limited_with_value(
        key, limit=rate_limit.limit, window=rate_limit.window
    )
    remaining = rate_limit.limit - current if not is_limited else 0
    return RateLimitMeta(
        is_limited=is_limited,
        current=current,
        limit=rate_limit.limit,
        window=rate_limit.window,
        reset_time=reset_time,
        remaining=remaining,
    )


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

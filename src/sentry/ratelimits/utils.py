from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Mapping, Type

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.ratelimits.concurrent import ConcurrentRateLimiter
from sentry.ratelimits.config import DEFAULT_RATE_LIMIT_CONFIG, RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory, RateLimitMeta, RateLimitType
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

_CONCURRENT_RATE_LIMITER = ConcurrentRateLimiter()


def concurrent_limiter() -> ConcurrentRateLimiter:
    global _CONCURRENT_RATE_LIMITER
    if not _CONCURRENT_RATE_LIMITER:
        _CONCURRENT_RATE_LIMITER = ConcurrentRateLimiter()
    return _CONCURRENT_RATE_LIMITER


def get_rate_limit_key(view_func: EndpointFunction, request: Request) -> str | None:
    """Construct a consistent global rate limit key using the arguments provided"""
    if not hasattr(view_func, "view_class") or request.path_info.startswith(
        settings.ANONYMOUS_STATIC_PREFIXES
    ):
        return None

    view = view_func.__qualname__
    rate_limit_config = get_rate_limit_config(view_func.view_class)  # type: ignore
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
    group = rate_limit_config.group if rate_limit_config else "default"
    if rate_limit_config and rate_limit_config.has_custom_limit():
        # if there is a custom rate limit on the endpoint, we add view to the key
        # otherwise we just use what's default for the group
        return f"{category}:{group}:{view}:{http_method}:{id}"
    else:
        return f"{category}:{group}:{http_method}:{id}"


def get_organization_id_from_token(token_id: str) -> int | None:
    from sentry.models import SentryAppInstallation

    installation = SentryAppInstallation.objects.get_by_api_token(token_id).first()
    return installation.organization_id if installation else None


def get_rate_limit_config(endpoint: Type[object]) -> RateLimitConfig | None:
    """Read the rate limit config from the view function to be used for the rate limit check.

    If there is no rate limit defined on the endpoint, use the rate limit defined for the group
    or the default across the board
    """
    rate_limit_config = getattr(endpoint, "rate_limits", DEFAULT_RATE_LIMIT_CONFIG)
    return RateLimitConfig.from_rate_limit_override_dict(rate_limit_config)


def get_rate_limit_value(
    http_method: str, endpoint: Type[object], category: RateLimitCategory
) -> RateLimit | None:
    """Read the rate limit from the view function to be used for the rate limit check."""
    # types are hashable in python, the type checker disagrees though
    rate_limit_config = get_rate_limit_config(endpoint)
    if not rate_limit_config:
        return None
    return rate_limit_config.get_rate_limit(http_method, category)


def above_rate_limit_check(key: str, rate_limit: RateLimit, request_uid: str) -> RateLimitMeta:
    rate_limit_type = RateLimitType.NOT_LIMITED
    window_limited, current, reset_time = ratelimiter.is_limited_with_value(
        key, limit=rate_limit.limit, window=rate_limit.window
    )
    remaining = 0
    remaining = rate_limit.limit - current if not window_limited else 0
    if window_limited:
        rate_limit_type = RateLimitType.FIXED_WINDOW
    concurrent_requests = None
    if rate_limit.concurrent_limit is not None:
        concurrent_requests = concurrent_limiter().start_request(
            key, rate_limit.concurrent_limit, request_uid
        )
        # TODO: This is a little clunky. I do this comparison here and in
        # the rate limit class. Maybe make the rate limit class return a
        # a payload with metadata?
        if concurrent_requests >= rate_limit.concurrent_limit:
            rate_limit_type = RateLimitType.CONCURRENT

    return RateLimitMeta(
        rate_limit_type=rate_limit_type,
        current=current,
        limit=rate_limit.limit,
        window=rate_limit.window,
        reset_time=reset_time,
        remaining=remaining,
        concurrent_limit=rate_limit.concurrent_limit,
        concurrent_requests=concurrent_requests,
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

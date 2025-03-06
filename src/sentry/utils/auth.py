from __future__ import annotations

import logging
from collections.abc import Collection, Iterable, Mapping, Sequence
from datetime import datetime, timedelta, timezone
from time import time
from typing import Any, cast
from urllib.parse import urlencode, urlparse

from django.conf import settings
from django.contrib.auth import login as _login
from django.contrib.auth.backends import ModelBackend
from django.http.request import HttpRequest
from django.urls import resolve, reverse
from django.utils.http import url_has_allowed_host_and_scheme
from rest_framework.request import Request

from sentry import options
from sentry.demo_mode.utils import is_demo_mode_enabled, is_demo_user
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.organization import Organization
from sentry.organizations.absolute_url import generate_organization_url
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.auth")

_LOGIN_URL: str | None = None

MFA_SESSION_KEY = "mfa"

DISABLE_SSO_CHECK_FOR_LOCAL_DEV = getattr(settings, "DISABLE_SSO_CHECK_FOR_LOCAL_DEV", False)


def _sso_expiry_from_env(seconds: str | None) -> timedelta:
    if seconds is None:
        return timedelta(days=7)
    return timedelta(seconds=int(seconds))


SSO_EXPIRY_TIME = _sso_expiry_from_env(settings.SENTRY_SSO_EXPIRY_SECONDS)


class SsoSession:
    """
    The value returned from to_dict is stored in the django session cookie, with the org id being the key.
    """

    SSO_SESSION_KEY = "sso_s"
    SSO_LOGIN_TIMESTAMP = "ts"

    def __init__(self, organization_id: int, time: datetime) -> None:
        self.organization_id = organization_id
        self.authenticated_at_time = time
        self.session_key = self.django_session_key(organization_id)

    def to_dict(self) -> dict[str, Any]:
        return {self.SSO_LOGIN_TIMESTAMP: self.authenticated_at_time.timestamp()}

    @classmethod
    def create(cls, organization_id: int) -> SsoSession:
        return cls(organization_id, datetime.now(tz=timezone.utc))

    @classmethod
    def from_django_session_value(
        cls, organization_id: int, session_value: Mapping[str, Any]
    ) -> SsoSession:
        return cls(
            organization_id,
            datetime.fromtimestamp(session_value[cls.SSO_LOGIN_TIMESTAMP], tz=timezone.utc),
        )

    def is_sso_authtime_fresh(self) -> bool:
        expired_time_cutoff = datetime.now(tz=timezone.utc) - SSO_EXPIRY_TIME

        return self.authenticated_at_time > expired_time_cutoff

    @staticmethod
    def django_session_key(organization_id: int) -> str:
        return f"{SsoSession.SSO_SESSION_KEY}:{organization_id}"


class AuthUserPasswordExpired(Exception):
    def __init__(self, user: User) -> None:
        self.user = user


def get_auth_providers() -> Collection[str]:
    return [
        key
        for key, cfg_names in settings.AUTH_PROVIDERS.items()
        if all(getattr(settings, c, None) for c in cfg_names)
    ]


def get_pending_2fa_user(request: HttpRequest) -> User | None:
    rv = request.session.get("_pending_2fa")
    if rv is None:
        return None

    user_id, created_at = rv[:2]
    if created_at < time() - 60 * 5:
        return None

    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None


def has_pending_2fa(request: HttpRequest) -> bool:
    return request.session.get("_pending_2fa") is not None


def get_login_url(reset: bool = False) -> str:
    global _LOGIN_URL

    if _LOGIN_URL is None or reset:
        # if LOGIN_URL resolves force login_required to it instead of our own
        # XXX: this must be done as late as possible to avoid idempotent requirements
        try:
            resolve(settings.LOGIN_URL)
        except Exception:
            _LOGIN_URL = settings.SENTRY_LOGIN_URL
        else:
            _LOGIN_URL = settings.LOGIN_URL

        if _LOGIN_URL is None:
            _LOGIN_URL = reverse("sentry-login")
        # ensure type is coerced to string (to avoid lazy proxies)
        _LOGIN_URL = str(_LOGIN_URL)
    return _LOGIN_URL


def initiate_login(
    request: HttpRequest, next_url: str | None = None, referrer: str | None = None
) -> None:
    """
    initiate_login simply clears session cache
    if provided a `next_url` will append to the session after clearing previous keys
    """
    for key in ("_next", "_after_2fa", "_pending_2fa", "_referrer"):
        try:
            del request.session[key]
        except KeyError:
            pass

    if next_url:
        request.session["_next"] = next_url
    if referrer:
        request.session["_referrer"] = referrer


def get_org_redirect_url(request: HttpRequest, active_organization: RpcOrganization | None) -> str:
    from sentry import features

    # TODO(dcramer): deal with case when the user cannot create orgs
    if active_organization:
        return Organization.get_url(active_organization.slug)
    if not features.has("organizations:create"):
        return "/auth/login/"
    return "/organizations/new/"


def _get_login_redirect(request: HttpRequest, default: str | None = None) -> str:
    if default is None:
        default = get_login_url()

    # If there is a pending 2fa authentication bound to the session then
    # we need to go to the 2fa dialog.
    if has_pending_2fa(request):
        return reverse("sentry-2fa-dialog")

    # If we have a different URL to go after the 2fa flow we want to go to
    # that now here.
    after_2fa = request.session.pop("_after_2fa", None)
    if after_2fa is not None:
        return cast(str, after_2fa)

    login_url = request.session.pop("_next", None)
    if not login_url:
        return default

    if not is_valid_redirect(login_url, allowed_hosts=(request.get_host(),)):
        login_url = default

    return cast(str, login_url)


def get_login_redirect(request: HttpRequest, default: str | None = None) -> str:
    login_redirect = _get_login_redirect(request, default)
    url_prefix = None
    if hasattr(request, "subdomain") and request.subdomain:
        url_prefix = generate_organization_url(request.subdomain)
        return absolute_uri(login_redirect, url_prefix=url_prefix)
    return login_redirect


def is_valid_redirect(url: str, allowed_hosts: Iterable[str] | None = None) -> bool:
    if not url:
        return False
    if url.startswith(get_login_url()):
        return False
    parsed_url = urlparse(url)
    url_host = parsed_url.netloc
    base_hostname = options.get("system.base-hostname")
    if url_host.endswith(f".{base_hostname}"):
        if allowed_hosts is None:
            allowed_hosts = {url_host}
        else:
            allowed_hosts = set(allowed_hosts)
            allowed_hosts.add(url_host)
    return url_has_allowed_host_and_scheme(url, allowed_hosts=allowed_hosts)


def mark_sso_complete(request: HttpRequest, organization_id: int) -> None:
    """
    Store sso session status in the django session per org, with the value being the timestamp of when they logged in,
    for usage when expiring sso sessions.
    """
    # TODO(dcramer): this needs to be bound based on SSO options (e.g. changing
    # or enabling SSO invalidates this)
    sso_session = SsoSession.create(organization_id)
    request.session[sso_session.session_key] = sso_session.to_dict()

    metrics.incr("sso.session-added-success")

    request.session.modified = True


def has_completed_sso(request: HttpRequest, organization_id: int) -> bool:
    """
    look for the org id under the sso session key, and check that the timestamp isn't past our expiry limit
    """
    if DISABLE_SSO_CHECK_FOR_LOCAL_DEV:
        return True

    sso_session_in_request = request.session.get(
        SsoSession.django_session_key(organization_id), None
    )

    if not sso_session_in_request:
        metrics.incr("sso.no-value-in-session")
        return False

    django_session_value = SsoSession.from_django_session_value(
        organization_id, sso_session_in_request
    )

    if not django_session_value.is_sso_authtime_fresh():
        metrics.incr("sso.session-timed-out")
        return False

    metrics.incr("sso.session-verify-success")

    return True


def find_users(
    username: str, with_valid_password: bool = True, is_active: bool | None = None
) -> Sequence[User]:
    """
    Return a list of users that match a username
    and falling back to email
    """
    queryset = User.objects.filter()
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active)
    if with_valid_password:
        queryset = queryset.exclude(password="!")
    try:
        # First try username case insenstive match on username.
        user = queryset.get(username__iexact=username)
        return [user]
    except User.DoesNotExist:
        # If not, we can take a stab at guessing it's an email address
        if "@" in username:
            # email isn't guaranteed unique
            return list(queryset.filter(email__iexact=username))
        return []


def login(
    request: HttpRequest,
    user: User,
    passed_2fa: bool | None = None,
    after_2fa: str | None = None,
    organization_id: int | None = None,
    source: Any = None,
) -> bool:
    """
    This logs a user in for the session and current request.

    If 2FA is enabled this method will start the MFA flow and return False as
    required.  If `passed_2fa` is set to `True` then the 2FA flow is set to be
    finalized (user passed the flow).

    If the session has already resolved MFA in the past, it will automatically
    detect it from the session.

    Optionally `after_2fa` can be set to a URL which will be used to override
    the regular session redirect target directly after the 2fa flow.

    Returns boolean indicating if the user was logged in.
    """
    if passed_2fa is None:
        passed_2fa = request.session.get(MFA_SESSION_KEY, "") == str(user.id)

    if user.has_2fa() and not passed_2fa:
        request.session["_pending_2fa"] = [user.id, time(), organization_id]
        if after_2fa is not None:
            request.session["_after_2fa"] = after_2fa
        request.session.modified = True
        return False

    # TODO(dcramer): this needs to be bound based on MFA options
    if passed_2fa:
        request.session[MFA_SESSION_KEY] = str(user.id)
        request.session.modified = True

    mfa_state = request.session.pop("_pending_2fa", ())
    if organization_id is None and len(mfa_state) == 3:
        organization_id = mfa_state[2]

    # Check for expired passwords here after we cleared the 2fa flow.
    # While this means that users will have to pass 2fa before they can
    # figure out that their passwords are expired this is still the more
    # reasonable behavior.
    #
    # We also remember _after_2fa here so that we can continue the flow if
    # someone does it in the same browser.
    if user.is_password_expired:
        raise AuthUserPasswordExpired(user)

    # If this User has a nonce value, we need to bind into the session.
    if user.session_nonce is not None:
        request.session["_nonce"] = user.session_nonce

    # If there is no authentication backend, just attach the first
    # one and hope it goes through.  This apparently is a thing we
    # have been doing for a long time, just moved it to a more
    # reasonable place.
    if not hasattr(user, "backend"):
        user.backend = settings.AUTHENTICATION_BACKENDS[0]
    if organization_id:
        mark_sso_complete(request, organization_id)

    # Do not require flush the user during login -- the mutation here is just  `last_login` update which isn't
    # critical to flush.
    with outbox_context(flush=False):
        _login(request, user)

    log_auth_success(request, user.username, organization_id, source)
    return True


def log_auth_success(
    request: HttpRequest,
    username: str,
    organization_id: int | None = None,
    source: Any = None,
) -> None:
    logger.info(
        "user.auth.success",
        extra={
            "ip_address": request.META["REMOTE_ADDR"],
            "username": username,
            "organization_id": organization_id,
            "source": source,
        },
    )


def log_auth_failure(request: HttpRequest, username: str | None = None) -> None:
    logger.info(
        "user.auth.fail", extra={"ip_address": request.META["REMOTE_ADDR"], "username": username}
    )


def has_user_registration() -> bool:
    from sentry import features, options

    return features.has("auth:register") and options.get("auth.allow-registration")


def is_user_signed_request(request: HttpRequest) -> bool:
    """
    This function returns True if the request is a signed valid link
    """
    try:
        return bool(request.user_from_signed_request)
    except AttributeError:
        return False


def set_active_org(request: HttpRequest, org_slug: str) -> None:
    # even if the value being set is the same this will trigger a session
    # modification and reset the users expiry, so check if they are different first.
    if hasattr(request, "session") and request.session.get("activeorg") != org_slug:
        request.session["activeorg"] = org_slug


class EmailAuthBackend(ModelBackend):
    """
    Authenticate against django.contrib.auth.models.User.

    Supports authenticating via an email address or a username.
    """

    def authenticate(
        self, request: HttpRequest, username: str, password: str | None = None
    ) -> User | None:
        users = find_users(username)
        if users:
            for user in users:
                try:
                    if is_demo_mode_enabled() and is_demo_user(user):
                        return user
                    if user.password:
                        # XXX(joshuarli): This is checked before (and therefore, regardless of outcome)
                        # password checking as a mechanism to drop old password hashers immediately and
                        # then lazily sending out password reset emails.
                        if user.is_password_expired:
                            raise AuthUserPasswordExpired(user)
                        if user.check_password(password):
                            return user
                except ValueError:
                    continue
        return None

    def user_can_authenticate(self, user: User) -> bool:
        return True

    def get_user(self, user_id: int) -> RpcUser | None:
        user = user_service.get_user(user_id=user_id)
        if user:
            return user
        return None


def construct_link_with_query(path: str, query_params: dict[str, str]) -> str:
    """
    constructs a link with url encoded query params given a base path
    """
    query_string = urlencode({k: v for k, v in query_params.items() if v})
    redirect_uri = f"{path}"
    if query_string:
        redirect_uri += f"?{query_string}"
    return redirect_uri


# Used to create a HttpRequest that's guaranteed to have an authenticated user
# Ref: https://github.com/typeddjango/django-stubs?tab=readme-ov-file#how-can-i-create-a-httprequest-thats-guaranteed-to-have-an-authenticated-user
class AuthenticatedHttpRequest(Request):
    user: User

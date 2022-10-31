from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from time import time
from typing import Container, Optional
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.contrib.auth import login as _login
from django.contrib.auth.backends import ModelBackend
from django.http.request import HttpRequest
from django.urls import resolve, reverse
from django.utils.http import is_safe_url
from rest_framework.request import Request

from sentry.models import Authenticator, Organization, User
from sentry.services.hybrid_cloud import ApiOrganization
from sentry.utils import metrics
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.auth")

_LOGIN_URL = None
from typing import Any, Dict, Mapping

MFA_SESSION_KEY = "mfa"


def _sso_expiry_from_env(seconds: str | None) -> timedelta:
    if seconds is None:
        return timedelta(hours=20)
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

    def to_dict(self) -> Dict[str, Any]:
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
    def __init__(self, user):
        self.user = user


def get_auth_providers():
    return [
        key
        for key, cfg_names in settings.AUTH_PROVIDERS.items()
        if all(getattr(settings, c, None) for c in cfg_names)
    ]


def get_pending_2fa_user(request):
    rv = request.session.get("_pending_2fa")
    if rv is None:
        return

    user_id, created_at = rv[:2]
    if created_at < time() - 60 * 5:
        return None

    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        pass


def has_pending_2fa(request):
    return request.session.get("_pending_2fa") is not None


def get_login_url(reset=False):
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


def initiate_login(request, next_url=None):
    for key in ("_next", "_after_2fa", "_pending_2fa"):
        try:
            del request.session[key]
        except KeyError:
            pass

    if next_url:
        request.session["_next"] = next_url


def get_org_redirect_url(request, active_organization: Optional[ApiOrganization]):
    from sentry import features

    # TODO(dcramer): deal with case when the user cannot create orgs
    if active_organization:
        return Organization.get_url(active_organization.slug)
    if not features.has("organizations:create"):
        return "/auth/login/"
    return "/organizations/new/"


def _get_login_redirect(request, default=None):
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
        return after_2fa

    login_url = request.session.pop("_next", None)
    if not login_url:
        return default

    if not is_valid_redirect(login_url, allowed_hosts=(request.get_host(),)):
        login_url = default

    return login_url


def get_login_redirect(request, default=None):
    from sentry.api.utils import generate_organization_url

    login_redirect = _get_login_redirect(request, default)
    url_prefix = None
    if hasattr(request, "subdomain") and request.subdomain:
        url_prefix = generate_organization_url(request.subdomain)
        return absolute_uri(login_redirect, url_prefix=url_prefix)
    return login_redirect


def is_valid_redirect(url: str, allowed_hosts: Optional[Container] = None) -> bool:
    if not url:
        return False
    if url.startswith(get_login_url()):
        return False
    return is_safe_url(url, allowed_hosts=allowed_hosts)


def mark_sso_complete(request, organization_id):
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


def has_completed_sso(request, organization_id) -> bool:
    """
    look for the org id under the sso session key, and check that the timestamp isn't past our expiry limit
    """
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


def find_users(username, with_valid_password=True, is_active=None):
    """
    Return a list of users that match a username
    and falling back to email
    """
    qs = User.objects

    if is_active is not None:
        qs = qs.filter(is_active=is_active)

    if with_valid_password:
        qs = qs.exclude(password="!")

    try:
        # First, assume username is an iexact match for username
        user = qs.get(username__iexact=username)
        return [user]
    except User.DoesNotExist:
        # If not, we can take a stab at guessing it's an email address
        if "@" in username:
            # email isn't guaranteed unique
            return list(qs.filter(email__iexact=username))
    return []


def login(
    request: HttpRequest, user, passed_2fa=None, after_2fa=None, organization_id=None, source=None
):
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
    has_2fa = Authenticator.objects.user_has_2fa(user)
    if passed_2fa is None:
        passed_2fa = request.session.get(MFA_SESSION_KEY, "") == str(user.id)

    if has_2fa and not passed_2fa:
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
    _login(request, user)

    log_auth_success(request, user.username, organization_id, source)
    return True


def log_auth_success(request, username, organization_id=None, source=None):
    logger.info(
        "user.auth.success",
        extra={
            "ip_address": request.META["REMOTE_ADDR"],
            "username": username,
            "organization_id": organization_id,
            "source": source,
        },
    )


def log_auth_failure(request, username=None):
    logger.info(
        "user.auth.fail", extra={"ip_address": request.META["REMOTE_ADDR"], "username": username}
    )


def has_user_registration():
    from sentry import features, options

    return features.has("auth:register") and options.get("auth.allow-registration")


def is_user_signed_request(request):
    """
    This function returns True if the request is a signed valid link
    """
    try:
        return request.user_from_signed_request
    except AttributeError:
        return False


def set_active_org(request: Request, org_slug: str) -> None:
    # even if the value being set is the same this will trigger a session
    # modification and reset the users expiry, so check if they are different first.
    if hasattr(request, "session") and request.session.get("activeorg") != org_slug:
        request.session["activeorg"] = org_slug


class EmailAuthBackend(ModelBackend):
    """
    Authenticate against django.contrib.auth.models.User.

    Supports authenticating via an email address or a username.
    """

    def authenticate(self, request: Request, username=None, password=None):
        users = find_users(username)
        if users:
            for user in users:
                try:
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

    def user_can_authenticate(self, user):
        return True


def make_login_link_with_redirect(path, redirect):
    """
    append an after login redirect to a path.
    note: this function assumes that the redirect has been validated
    """
    query_string = urlencode({REDIRECT_FIELD_NAME: redirect})
    redirect_uri = f"{path}?{query_string}"
    return redirect_uri

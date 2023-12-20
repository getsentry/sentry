from __future__ import annotations

import ipaddress
import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.core.signing import BadSignature
from django.utils import timezone
from django.utils.crypto import constant_time_compare, get_random_string
from rest_framework.request import Request

from sentry.auth.elevated_mode import ElevatedMode
from sentry.auth.system import is_system_auth
from sentry.utils.auth import has_completed_sso

logger = logging.getLogger("sentry.staff")

SESSION_KEY = "_staff"

COOKIE_NAME = getattr(settings, "STAFF_COOKIE_NAME", "staff")

COOKIE_SALT = getattr(settings, "STAFF_COOKIE_SALT", "")

COOKIE_SECURE = getattr(settings, "STAFF_COOKIE_SECURE", settings.SESSION_COOKIE_SECURE)

COOKIE_DOMAIN = getattr(settings, "STAFF_COOKIE_DOMAIN", settings.SESSION_COOKIE_DOMAIN)

COOKIE_PATH = getattr(settings, "STAFF_COOKIE_PATH", settings.SESSION_COOKIE_PATH)

COOKIE_HTTPONLY = getattr(settings, "STAFF_COOKIE_HTTPONLY", True)

# the maximum time the session can stay alive
MAX_STAFF_SESSION_AGE = timedelta(hours=4)

IDLE_MAX_STAFF_SESSION_AGE = timedelta(minutes=15)

ALLOWED_IPS = frozenset(getattr(settings, "STAFF_ALLOWED_IPS", settings.INTERNAL_IPS) or ())

ORG_ID = getattr(settings, "STAFF_ORG_ID", None)

DISABLE_SSO_CHECK_FOR_LOCAL_DEV = getattr(settings, "DISABLE_SSO_CHECK_FOR_LOCAL_DEV", False)

UNSET = object()


def is_active_staff(request: Request) -> bool:
    if is_system_auth(getattr(request, "auth", None)):
        return True
    staff = getattr(request, "staff", None) or Staff(request)
    return staff.is_active


class Staff(ElevatedMode):
    allowed_ips = frozenset(ipaddress.ip_network(str(v), strict=False) for v in ALLOWED_IPS)

    def __init__(self, request, allowed_ips=UNSET, current_datetime=None):
        self.uid: str | None = None
        self.request = request
        if allowed_ips is not UNSET:
            self.allowed_ips = frozenset(
                ipaddress.ip_network(str(v), strict=False) for v in allowed_ips or ()
            )
        self._populate(current_datetime=current_datetime)

    @property
    def is_active(self):
        # We have a wsgi request with no user.
        if not hasattr(self.request, "user"):
            return False
        # if we've been logged out
        if not self.request.user.is_authenticated:
            return False
        # if staff status was changed
        if not self.request.user.is_staff:
            return False
        # if the user has changed
        if str(self.request.user.id) != self.uid:
            return False
        return self._is_active

    def is_privileged_request(self):
        """
        Returns ``(bool is_privileged, str reason)``
        """
        allowed_ips = self.allowed_ips

        # _admin should have always completed SSO to gain status.
        # We expect ORG_ID to always be set in production.
        if ORG_ID and not has_completed_sso(self.request, ORG_ID):
            if not DISABLE_SSO_CHECK_FOR_LOCAL_DEV:
                return False, "incomplete-sso"

        # if there's no IPs configured, we allow assume its the same as *
        if not allowed_ips:
            return True, None
        ip = ipaddress.ip_address(str(self.request.META["REMOTE_ADDR"]))
        if not any(ip in addr for addr in allowed_ips):
            return False, "invalid-ip"
        return True, None

    def get_session_data(self, current_datetime=None):
        """
        Return the current session data, with native types coerced.
        """
        request = self.request
        data = request.session.get(SESSION_KEY)

        try:
            cookie_token = request.get_signed_cookie(
                key=COOKIE_NAME,
                default=None,
                salt=COOKIE_SALT,
                max_age=MAX_STAFF_SESSION_AGE.total_seconds(),
            )
        except BadSignature:
            logger.exception(
                "staff.bad-cookie-signature",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        if not cookie_token:
            if data:
                logger.warning(
                    "staff.missing-cookie-token",
                    extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                )
            return
        elif not data:
            logger.warning(
                "staff.missing-session-data",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        session_token = data.get("tok")
        if not session_token:
            logger.warning(
                "staff.missing-session-token",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        if not constant_time_compare(cookie_token, session_token):
            logger.warning(
                "staff.invalid-token",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        if data["uid"] != str(request.user.id):
            logger.warning(
                "staff.invalid-uid",
                extra={
                    "ip_address": request.META["REMOTE_ADDR"],
                    "user_id": request.user.id,
                    "expected_user_id": data["uid"],
                },
            )
            return

        if current_datetime is None:
            current_datetime = timezone.now()

        try:
            data["idl"] = datetime.utcfromtimestamp(float(data["idl"])).replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            logger.warning(
                "staff.invalid-idle-expiration",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                exc_info=True,
            )
            return

        if data["idl"] < current_datetime:
            logger.info(
                "staff.session-expired",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        try:
            data["exp"] = datetime.utcfromtimestamp(float(data["exp"])).replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            logger.warning(
                "staff.invalid-expiration",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                exc_info=True,
            )
            return

        if data["exp"] < current_datetime:
            logger.info(
                "staff.session-expired",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        return data

    def _populate(self, current_datetime=None):
        if current_datetime is None:
            current_datetime = timezone.now()

        request = self.request
        user = getattr(request, "user", None)
        if not hasattr(request, "session"):
            data = None
        elif not (user and user.is_staff):
            data = None
        else:
            data = self.get_session_data(current_datetime=current_datetime)

        if not data:
            self._set_logged_out()
        else:
            self._set_logged_in(expires=data["exp"], token=data["tok"], user=user)

            if not self.is_active:
                if self._inactive_reason:
                    logger.warning(
                        "staff.%s",
                        self._inactive_reason,
                        extra={
                            "ip_address": request.META["REMOTE_ADDR"],
                            "user_id": request.user.id,
                        },
                    )
                else:
                    logger.warning(
                        "staff.inactive-unknown-reason",
                        extra={
                            "ip_address": request.META["REMOTE_ADDR"],
                            "user_id": request.user.id,
                        },
                    )

    def _set_logged_in(self, expires, token, user, current_datetime=None):
        # we bind uid here, as if you change users in the same request
        # we wouldn't want to still support staff auth (given
        # the staff check happens right here)
        assert user.is_staff
        if current_datetime is None:
            current_datetime = timezone.now()
        self.token = token
        self.uid = str(user.id)
        # the absolute maximum age of this session
        self.expires = expires
        # do we have a valid staff session?
        self.is_valid = True
        # is the session active? (it could be valid, but inactive)
        self._is_active, self._inactive_reason = self.is_privileged_request()
        self.request.session[SESSION_KEY] = {
            "exp": self.expires.strftime("%s"),
            "idl": (current_datetime + IDLE_MAX_STAFF_SESSION_AGE).strftime("%s"),
            "tok": self.token,
            # XXX(dcramer): do we really need the uid safety mechanism
            "uid": self.uid,
        }

    def _set_logged_out(self):
        self.uid = None
        self.expires = None
        self.token = None
        self._is_active = False
        self._inactive_reason = None
        self.is_valid = False
        self.request.session.pop(SESSION_KEY, None)

    def set_logged_in(self, user, current_datetime=None):
        """
        Mark a session as staff-enabled.
        """
        request = self.request
        if current_datetime is None:
            current_datetime = timezone.now()

        self._set_logged_in(
            expires=current_datetime + MAX_STAFF_SESSION_AGE,
            token=get_random_string(12),
            user=user,
            current_datetime=current_datetime,
        )
        logger.info(
            "staff.logged-in",
            extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": user.id},
        )

    def set_logged_out(self):
        """
        Mark a session as staff-disabled.
        """
        request = self.request
        self._set_logged_out()
        logger.info(
            "staff.logged-out",
            extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
        )

    def on_response(self, response):
        request = self.request

        # always re-bind the cookie to update the idle expiration window
        if self.is_active:
            response.set_signed_cookie(
                COOKIE_NAME,
                self.token,
                salt=COOKIE_SALT,
                # set max_age to None, as we want this cookie to expire on browser close
                max_age=None,
                secure=request.is_secure() if COOKIE_SECURE is None else COOKIE_SECURE,
                httponly=COOKIE_HTTPONLY,
                path=COOKIE_PATH,
                domain=COOKIE_DOMAIN,
            )
        # otherwise, if the session is invalid and there's a cookie set, clear it
        elif not self.is_valid and request.COOKIES.get(COOKIE_NAME):
            response.delete_cookie(COOKIE_NAME)

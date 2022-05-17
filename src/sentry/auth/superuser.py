"""
Superuser in Sentry works differently than the native Django implementation.

In Sentry a user must achieve the following to be treated as a superuser:

- ``User.is_superuser`` must be True
- If configured, the user must be accessing Sentry from a privileged IP (``SUPERUSER_ALLOWED_IPS``)
- The user must have a valid 'superuser session', which is a secondary session on top of their
  standard auth. This session has a shorter lifespan.
"""


import ipaddress
import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.core.signing import BadSignature
from django.utils import timezone
from django.utils.crypto import constant_time_compare, get_random_string
from rest_framework import serializers, status

from sentry.api.exceptions import SentryAPIException
from sentry.auth.system import is_system_auth
from sentry.utils import json, metrics
from sentry.utils.auth import has_completed_sso
from sentry.utils.settings import is_self_hosted

logger = logging.getLogger("sentry.superuser")

SESSION_KEY = "_su"

COOKIE_NAME = getattr(settings, "SUPERUSER_COOKIE_NAME", "su")

COOKIE_SALT = getattr(settings, "SUPERUSER_COOKIE_SALT", "")

COOKIE_SECURE = getattr(settings, "SUPERUSER_COOKIE_SECURE", settings.SESSION_COOKIE_SECURE)

COOKIE_DOMAIN = getattr(settings, "SUPERUSER_COOKIE_DOMAIN", settings.SESSION_COOKIE_DOMAIN)

COOKIE_PATH = getattr(settings, "SUPERUSER_COOKIE_PATH", settings.SESSION_COOKIE_PATH)

COOKIE_HTTPONLY = getattr(settings, "SUPERUSER_COOKIE_HTTPONLY", True)

# the maximum time the session can stay alive
MAX_AGE = getattr(settings, "SUPERUSER_MAX_AGE", timedelta(hours=4))

# the maximum time the session can stay alive when accessing different orgs
MAX_AGE_PRIVILEGED_ORG_ACCESS = getattr(
    settings, "MAX_AGE_PRIVILEGED_ORG_ACCESS", timedelta(hours=1)
)

# the maximum time the session can stay alive without making another request
IDLE_MAX_AGE = getattr(settings, "SUPERUSER_IDLE_MAX_AGE", timedelta(minutes=15))

ALLOWED_IPS = frozenset(getattr(settings, "SUPERUSER_ALLOWED_IPS", settings.INTERNAL_IPS) or ())

ORG_ID = getattr(settings, "SUPERUSER_ORG_ID", None)

SUPERUSER_ACCESS_CATEGORIES = getattr(settings, "SUPERUSER_ACCESS_CATEGORIES", ["for_unit_test"])

UNSET = object()

ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV = getattr(settings, "ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV", False)


def is_active_superuser(request):
    if is_system_auth(getattr(request, "auth", None)):
        return True
    su = getattr(request, "superuser", None) or Superuser(request)
    return su.is_active


class SuperuserAccessSerializer(serializers.Serializer):
    superuserAccessCategory = serializers.ChoiceField(choices=SUPERUSER_ACCESS_CATEGORIES)
    superuserReason = serializers.CharField(min_length=4, max_length=128)


class SuperuserAccessFormInvalidJson(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid-superuser-access-json"
    message = "The request contains invalid json"


class EmptySuperuserAccessForm(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "empty-superuser-access-form"
    message = "The request contains an empty superuser acccess form data"


class Superuser:
    allowed_ips = [ipaddress.ip_network(str(v), strict=False) for v in ALLOWED_IPS]

    org_id = ORG_ID

    def _check_expired_on_org_change(self):
        if self.expires is not None:
            session_start_time = self.expires - MAX_AGE
            current_datetime = timezone.now()
            if current_datetime - session_start_time > MAX_AGE_PRIVILEGED_ORG_ACCESS:
                logger.warning(
                    "superuser.privileged_org_access_expired",
                    extra={"superuser_token": self.token},
                )
                self.set_logged_out()
                return False
        return self._is_active

    def __init__(self, request, allowed_ips=UNSET, org_id=UNSET, current_datetime=None):
        self.request = request
        if allowed_ips is not UNSET:
            self.allowed_ips = frozenset(
                ipaddress.ip_network(str(v), strict=False) for v in allowed_ips or ()
            )
        if org_id is not UNSET:
            self.org_id = org_id
        self._populate(current_datetime=current_datetime)

    @staticmethod
    def _needs_validation():
        if is_self_hosted() or ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV:
            return False
        return settings.VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON

    @property
    def is_active(self):
        org = getattr(self.request, "organization", None)
        if org and org.id != self.org_id:
            return self._check_expired_on_org_change()
        # if we've been logged out
        if not self.request.user.is_authenticated:
            return False
        # if superuser status was changed
        if not self.request.user.is_superuser:
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
        # if we've bound superuser to an organization they must
        # have completed SSO to gain status
        if self.org_id and not has_completed_sso(self.request, self.org_id):
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
                key=COOKIE_NAME, default=None, salt=COOKIE_SALT, max_age=MAX_AGE.total_seconds()
            )
        except BadSignature:
            logger.exception(
                "superuser.bad-cookie-signature",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        if not cookie_token:
            if data:
                logger.warning(
                    "superuser.missing-cookie-token",
                    extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                )
            return
        elif not data:
            logger.warning(
                "superuser.missing-session-data",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        session_token = data.get("tok")
        if not session_token:
            logger.warning(
                "superuser.missing-session-token",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        if not constant_time_compare(cookie_token, session_token):
            logger.warning(
                "superuser.invalid-token",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        if data["uid"] != str(request.user.id):
            logger.warning(
                "superuser.invalid-uid",
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
                "superuser.invalid-idle-expiration",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                exc_info=True,
            )
            return

        if data["idl"] < current_datetime:
            logger.info(
                "superuser.session-expired",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
            )
            return

        try:
            data["exp"] = datetime.utcfromtimestamp(float(data["exp"])).replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            logger.warning(
                "superuser.invalid-expiration",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
                exc_info=True,
            )
            return

        if data["exp"] < current_datetime:
            logger.info(
                "superuser.session-expired",
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
        elif not (user and user.is_superuser):
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
                        f"superuser.{self._inactive_reason}",
                        extra={
                            "ip_address": request.META["REMOTE_ADDR"],
                            "user_id": request.user.id,
                        },
                    )
                else:
                    logger.warning(
                        "superuser.inactive-unknown-reason",
                        extra={
                            "ip_address": request.META["REMOTE_ADDR"],
                            "user_id": request.user.id,
                        },
                    )

    def _set_logged_in(self, expires, token, user, current_datetime=None):
        # we bind uid here, as if you change users in the same request
        # we wouldn't want to still support superuser auth (given
        # the superuser check happens right here)
        assert user.is_superuser
        if current_datetime is None:
            current_datetime = timezone.now()
        self.token = token
        self.uid = str(user.id)
        # the absolute maximum age of this session
        self.expires = expires
        # do we have a valid superuser session?
        self.is_valid = True
        # is the session active? (it could be valid, but inactive)
        self._is_active, self._inactive_reason = self.is_privileged_request()
        self.request.session[SESSION_KEY] = {
            "exp": self.expires.strftime("%s"),
            "idl": (current_datetime + IDLE_MAX_AGE).strftime("%s"),
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
        Mark a session as superuser-enabled.
        """
        request = self.request
        if current_datetime is None:
            current_datetime = timezone.now()

        token = get_random_string(12)

        def enable_and_log_superuser_access():
            self._set_logged_in(
                expires=current_datetime + MAX_AGE,
                token=token,
                user=user,
                current_datetime=current_datetime,
            )

            metrics.incr(
                "superuser.success",
                sample_rate=1.0,
            )

            logger.info(
                "superuser.logged-in",
                extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": user.id},
            )

        if not self._needs_validation():
            enable_and_log_superuser_access()
            return

        try:
            # need to use json loads as the data is no longer in request.data
            su_access_json = json.loads(request.body)
        except json.JSONDecodeError:
            metrics.incr(
                "superuser.failure",
                sample_rate=1.0,
                tags={"reason": SuperuserAccessFormInvalidJson.code},
            )
            raise SuperuserAccessFormInvalidJson()
        except AttributeError:
            metrics.incr(
                "superuser.failure",
                sample_rate=1.0,
                tags={"reason": EmptySuperuserAccessForm.code},
            )
            raise EmptySuperuserAccessForm()

        su_access_info = SuperuserAccessSerializer(data=su_access_json)

        if not su_access_info.is_valid():
            raise serializers.ValidationError(su_access_info.errors)

        try:
            logger.info(
                "superuser.superuser_access",
                extra={
                    "superuser_token_id": token,
                    "user_id": request.user.id,
                    "user_email": request.user.email,
                    "su_access_category": su_access_info.validated_data["superuserAccessCategory"],
                    "reason_for_su": su_access_info.validated_data["superuserReason"],
                },
            )
            enable_and_log_superuser_access()
        except AttributeError:
            metrics.incr("superuser.failure", sample_rate=1.0, tags={"reason": "missing-user-info"})
            logger.error("superuser.superuser_access.missing_user_info")

    def set_logged_out(self):
        """
        Mark a session as superuser-disabled.
        """
        request = self.request
        self._set_logged_out()
        logger.info(
            "superuser.logged-out",
            extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": request.user.id},
        )

    def on_response(self, response, current_datetime=None):
        request = self.request

        if current_datetime is None:
            current_datetime = timezone.now()

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

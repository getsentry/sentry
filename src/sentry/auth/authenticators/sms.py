from __future__ import annotations

import logging
from hashlib import md5
from typing import TYPE_CHECKING

from django.utils.translation import gettext_lazy as _

from sentry.ratelimits import backend as ratelimiter
from sentry.utils.decorators import classproperty
from sentry.utils.otp import TOTP
from sentry.utils.sms import phone_number_as_e164, send_sms, sms_available

from .base import ActivationMessageResult, AuthenticatorInterface, OtpMixin

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise

logger = logging.getLogger("sentry.auth")


class SMSRateLimitExceeded(Exception):
    def __init__(self, phone_number, user_id, remote_ip):
        super().__init__()
        self.phone_number = phone_number
        self.user_id = user_id
        self.remote_ip = remote_ip


class SmsInterface(OtpMixin, AuthenticatorInterface):
    """This interface sends OTP codes via text messages to the user."""

    type = 2
    interface_id = "sms"
    name = _("Text Message")
    description = _(
        "This authenticator sends you text messages for "
        "verification.  It's useful as a backup method "
        "or when you do not have a phone that supports "
        "an authenticator application."
    )
    code_ttl = 45

    @classproperty
    def is_available(cls):
        return sms_available()

    def generate_new_config(self):
        config = super().generate_new_config()
        config["phone_number"] = None
        return config

    def make_otp(self):
        return TOTP(self.config["secret"], digits=6, interval=self.code_ttl, default_window=1)

    @property
    def phone_number(self):
        return self.config["phone_number"]

    @phone_number.setter
    def phone_number(self, value):
        self.config["phone_number"] = value

    def activate(self, request):
        phone_number = self.config["phone_number"]
        if len(phone_number) == 10:
            mask = "(***) ***-**%s" % (phone_number[-2:])
        else:
            mask = "{}{}".format((len(phone_number) - 2) * "*", phone_number[-2:])

        if self.send_text(request=request):
            return ActivationMessageResult(
                _(
                    "A confirmation code was sent to %(phone_mask)s. "
                    "It is valid for %(ttl)d seconds."
                )
                % {"phone_mask": "<strong>%s</strong>" % mask, "ttl": self.code_ttl}
            )
        return ActivationMessageResult(
            _(
                "Error: we failed to send a text message to you. You "
                "can try again later or sign in with a different method."
            ),
            type="error",
        )

    def send_text(self, for_enrollment=False, request=None):
        ctx = {"code": self.make_otp().generate_otp()}

        if for_enrollment:
            text: _StrPromise | str = _(
                "%(code)s is your Sentry two-factor enrollment code. "
                "You are about to set up text message based two-factor "
                "authentication."
            )
        else:
            text = _("%(code)s is your Sentry authentication code.")

        if request is not None:
            text = f"{text}\n"
            ctx["ip"] = request.META["REMOTE_ADDR"]

        if request and request.user.is_authenticated:
            user_id = request.user.id
        elif self.authenticator:
            user_id = self.authenticator.user_id
        else:
            user_id = None

        phone_number = phone_number_as_e164(self.phone_number)

        if ratelimiter.is_limited(
            f"sms:{md5(phone_number.encode('utf-8')).hexdigest()}",
            limit=3,
            window=300,
        ):
            raise SMSRateLimitExceeded(phone_number, user_id, request.META.get("REMOTE_ADDR", None))

        logger.info(
            "mfa.twilio-request",
            extra={
                "ip": request.META["REMOTE_ADDR"] if request else None,
                "user_id": user_id,
                "authenticator_id": self.authenticator.id if self.authenticator else None,
                "phone_number": phone_number,
            },
        )

        return send_sms(text % ctx, to=phone_number)

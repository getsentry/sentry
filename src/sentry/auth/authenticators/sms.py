import logging

from django.utils.translation import ugettext_lazy as _

from sentry.utils.decorators import classproperty
from sentry.utils.otp import TOTP
from sentry.utils.sms import send_sms, sms_available

from .base import ActivationMessageResult, AuthenticatorInterface, OtpMixin

logger = logging.getLogger("sentry.auth")


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

    def _get_phone_number(self):
        return self.config["phone_number"]

    def _set_phone_number(self, value):
        self.config["phone_number"] = value

    phone_number = property(_get_phone_number, _set_phone_number)
    del _get_phone_number, _set_phone_number

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
            text = _(
                "%(code)s is your Sentry two-factor enrollment code. "
                "You are about to set up text message based two-factor "
                "authentication."
            )
        else:
            text = _("%(code)s is your Sentry authentication code.")

        if request is not None:
            text = "{}\n\n{}".format(text, _("Requested from %(ip)s"))
            ctx["ip"] = request.META["REMOTE_ADDR"]

        if request and request.user.is_authenticated:
            user_id = request.user.id
        elif self.authenticator:
            user_id = self.authenticator.user_id
        else:
            user_id = None

        logger.info(
            "mfa.twilio-request",
            extra={
                "ip": request.META["REMOTE_ADDR"] if request else None,
                "user_id": user_id,
                "authenticator_id": self.authenticator.id if self.authenticator else None,
                "phone_number": self.phone_number,
            },
        )

        return send_sms(text % ctx, to=self.phone_number)

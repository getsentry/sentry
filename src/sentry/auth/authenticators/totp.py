from django.utils.translation import ugettext_lazy as _

from .base import AuthenticatorInterface, OtpMixin


class TotpInterface(OtpMixin, AuthenticatorInterface):
    """This interface uses TOTP with an authenticator."""

    type = 1
    interface_id = "totp"
    name = _("Authenticator App")
    description = _(
        "An authenticator application that supports TOTP (like "
        "Google Authenticator or 1Password) can be used to "
        "conveniently secure your account.  A new token is "
        "generated every 30 seconds."
    )

    def get_provision_url(self, user, issuer=None):
        return self.make_otp().get_provision_url(user, issuer=issuer)

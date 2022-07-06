from django.utils.translation import ugettext_lazy as _

from .base import AuthenticatorInterface, OtpMixin


class TotpInterface(OtpMixin, AuthenticatorInterface):
    """This interface uses TOTP with an authenticator."""

    type = 1
    interface_id = "totp"
    name = _("Authenticator App")
    allow_rotation_in_place = True
    description = _(
        "An authenticator application that supports TOTP (like "
        "Google Authenticator or 1Password) can be used to "
        "access your account securely using a token and secret key. "
        "A new token is generated every 30 seconds."
    )
    rotation_warning = _(
        "Your account is currently linked to an authenticator "
        "application. To link to a new device or application, "
        'or to update your secret key, click "Confirm" below. By '
        'clicking "Confirm", your existing secret key will be '
        "replaced and will no longer work to access your account."
    )

    def get_provision_url(self, user, issuer=None):
        return self.make_otp().get_provision_url(user, issuer=issuer)

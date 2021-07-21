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
    rotation_warning = _(
        "Your account is already linked to an authenticator "
        "application. You may link this code to a new device or new "
        "application. However, if you do, it will replace the "
        "existing authenticator secret, meaning that it can no longer "
        "be used to access your account. "
    )

    def get_provision_url(self, user, issuer=None):
        return self.make_otp().get_provision_url(user, issuer=issuer)

    @property
    def allow_rotation_in_place(self):
        return self.is_enrolled() and any(
            org.flags.require_2fa for org in self.authenticator.user.get_orgs()
        )

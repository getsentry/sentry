from __future__ import annotations

import hmac
from base64 import b32encode
from binascii import hexlify
from hashlib import sha1
from os import urandom
from typing import TYPE_CHECKING, Any

from django.utils.translation import gettext_lazy as _

from .base import AuthenticatorInterface

if TYPE_CHECKING:
    from sentry.users.models.authenticator import Authenticator


class RecoveryCodeInterface(AuthenticatorInterface):
    """A backup interface that is based on static recovery codes."""

    type = 0
    interface_id = "recovery"
    name = _("Recovery Codes")
    description = _(
        "Recovery codes are the only way to access your account "
        "if you lose your device and cannot receive two factor "
        "authentication codes."
    )
    enroll_button = _("Activate")
    configure_button = _("View Codes")
    remove_button = None
    is_backup_interface = True

    def __init__(self, authenticator: Authenticator | None = None) -> None:
        super().__init__(authenticator)

    def get_codes(self) -> list[str]:
        rv = []
        if self.is_enrolled():
            h = hmac.new(key=self.config["salt"].encode(), msg=None, digestmod=sha1)
            for x in range(10):
                h.update(f"{x}|".encode())
                rv.append(b32encode(h.digest())[:8].decode())
        return rv

    def generate_new_config(self) -> dict[str, Any]:
        salt = hexlify(urandom(16)).decode()
        return {"salt": salt, "used": 0}

    def regenerate_codes(self, save: bool = True) -> None:
        if not self.is_enrolled():
            raise RuntimeError("Interface is not enrolled")
        self.config.update(self.generate_new_config())

        assert self.authenticator, "Cannot regenerate codes without self.authenticator"
        self.authenticator.reset_fields(save=False)
        if save:
            self.authenticator.save()

    def validate_otp(self, otp: str) -> bool:
        mask = self.config["used"]
        code = otp.strip().replace("-", "").upper()
        for idx, ref_code in enumerate(self.get_codes()):
            if code == ref_code:
                if mask & (1 << idx):
                    break
                self.config["used"] = mask | (1 << idx)
                return True
        return False

    def get_unused_codes(self) -> list[str]:
        mask = self.config["used"]
        rv = []
        for idx, code in enumerate(self.get_codes()):
            if not mask & (1 << idx):
                rv.append(f"{code[:4]}-{code[4:]}")
        return rv

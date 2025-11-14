from __future__ import annotations

from typing import int, TYPE_CHECKING

from .base import AuthenticatorInterface
from .recovery_code import RecoveryCodeInterface
from .sms import SmsInterface
from .totp import TotpInterface
from .u2f import U2fInterface

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise

AUTHENTICATOR_INTERFACES: dict[str, type[AuthenticatorInterface]] = {}
AUTHENTICATOR_INTERFACES_BY_TYPE: dict[int, type[AuthenticatorInterface]] = {}
AUTHENTICATOR_CHOICES: list[tuple[int, str | _StrPromise]] = []


def register_authenticator(cls: type[AuthenticatorInterface]) -> None:
    AUTHENTICATOR_INTERFACES[cls.interface_id] = cls
    AUTHENTICATOR_INTERFACES_BY_TYPE[cls.type] = cls
    AUTHENTICATOR_CHOICES.append((cls.type, cls.name))
    AUTHENTICATOR_CHOICES.sort(key=lambda x: x[0])


def available_authenticators(ignore_backup: bool = False) -> list[type[AuthenticatorInterface]]:
    interfaces = AUTHENTICATOR_INTERFACES.values()
    if not ignore_backup:
        return [v for v in interfaces if v.is_available]
    return [v for v in interfaces if not v.is_backup_interface and v.is_available]


register_authenticator(SmsInterface)
register_authenticator(RecoveryCodeInterface)
register_authenticator(TotpInterface)
register_authenticator(U2fInterface)

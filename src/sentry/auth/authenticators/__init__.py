from .base import AuthenticatorInterface  # NOQA
from .recovery_code import RecoveryCodeInterface
from .sms import SmsInterface
from .totp import TotpInterface
from .u2f import U2fInterface

AUTHENTICATOR_INTERFACES = {}
AUTHENTICATOR_INTERFACES_BY_TYPE = {}
AUTHENTICATOR_CHOICES = []


def register_authenticator(cls):
    AUTHENTICATOR_INTERFACES[cls.interface_id] = cls
    AUTHENTICATOR_INTERFACES_BY_TYPE[cls.type] = cls
    AUTHENTICATOR_CHOICES.append((cls.type, cls.name))
    AUTHENTICATOR_CHOICES.sort(key=lambda x: x[0])


def available_authenticators(ignore_backup=False):
    interfaces = AUTHENTICATOR_INTERFACES.values()
    if not ignore_backup:
        return [v for v in interfaces if v.is_available]
    return [v for v in interfaces if not v.is_backup_interface and v.is_available]


register_authenticator(SmsInterface)
register_authenticator(RecoveryCodeInterface)
register_authenticator(TotpInterface)
register_authenticator(U2fInterface)

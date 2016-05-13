"""
sentry.models.authenticator
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os
import hmac
import base64
import hashlib

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from django.utils.functional import cached_property

from sentry.db.models import BaseManager, BaseModel, BoundedAutoField, \
    FlexibleForeignKey, BoundedPositiveIntegerField, UnicodePickledObjectField
from sentry.utils.otp import generate_secret_key, TOTP


class AuthenticatorManager(BaseManager):

    def get_for_user(self, user):
        return Authenticator.objects.filter(user=user)

    def user_has_2fa(self, user):
        return Authenticator.objects.filter(user=user).first() is not None

    def create_totp(self, user):
        return Authenticator.objects.create(
            user=user,
            type=TotpInterface.type,
            config={
                'secret': generate_secret_key(),
            }
        )

    def create_recovery_codes(self, user):
        return Authenticator.objects.create(
            user=user,
            type=RecoveryCodeInterface.type,
            config={
                'salt': os.urandom(16).encode('hex'),
                'used': 0,
            }
        )


AUTHENTICATOR_INTERFACES = {}
AUTHENTICATOR_CHOICES = []


def register_authenticator(cls):
    AUTHENTICATOR_INTERFACES[cls.type] = cls
    AUTHENTICATOR_CHOICES.append((cls.type, cls.name))
    return cls


class AuthenticatorInterface(object):
    type = -1
    interface_id = None
    name = None
    description = None

    def __init__(self, authenticator):
        self.authenticator = authenticator

    @property
    def config(self):
        return self.authenticator.config

    def validate_otp(self, otp):
        return False


@register_authenticator
class RecoveryCodeInterface(AuthenticatorInterface):
    type = 0
    interface_id = 'recovery'
    name = _('Recovery Codes')
    description = _('Recovery codes can be used to access your account in the '
                    'event you lose access to your device and cannot '
                    'receive two-factor authentication codes.')

    def __init__(self, authenticator):
        AuthenticatorInterface.__init__(self, authenticator)
        self.codes = []
        h = hmac.new(self.config['secret'], None, hashlib.sha1)
        for x in xrange(10):
            h.update('%s|' % x)
            self.codes.append(base64.b32encode(h.digest())[:8])

    def validate_otp(self, otp):
        mask = self.config['used']
        code = otp.strip().replace('-', '')
        for idx, ref_code in enumerate(self.codes):
            if code == ref_code:
                self.config['used'] = mask | (1 << idx)
                return True
        return False

    def get_unused_codes(self):
        mask = self.config['used']
        rv = []
        for idx, code in enumerate(self.codes):
            if not mask & (1 << idx):
                rv.append(code[:4] + '-' + code[4:])
        return rv


@register_authenticator
class TotpInterface(AuthenticatorInterface):
    type = 1
    interface_id = 'totp'
    name = _('Authenticator Application')
    description = _('An authenticator application that supports TOTP (like '
                    'Google Authenticator or 1Password) can be used to '
                    'conveniently secure your account.  A new token is '
                    'generated every 30 seconds.')

    def validate_otp(self, otp):
        return TOTP(self.config['secret']).verify(otp)


class Authenticator(BaseModel):
    id = BoundedAutoField(primary_key=True)
    user = FlexibleForeignKey('sentry.User', db_index=True)
    created_at = models.DateTimeField(_('created at'), default=timezone.now)
    last_used_at = models.DateTimeField(_('last used at'))
    type = BoundedPositiveIntegerField(choices=AUTHENTICATOR_CHOICES)
    config = UnicodePickledObjectField()

    objects = AuthenticatorManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'auth_authenticator'
        verbose_name = _('authenticator')
        verbose_name_plural = _('authenticators')

    @cached_property
    def interface(self):
        return AUTHENTICATOR_INTERFACES[self.type](self)

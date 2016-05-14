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

    def all_interfaces_for_user(self, user, return_missing=False):
        _sort = lambda x: sorted(x, key=lambda x: (x.type == 0, x.type))
        rv = [x.interface for x in Authenticator.objects.filter(user=user)]
        if not return_missing:
            return _sort(rv)
        rvm = dict(AUTHENTICATOR_INTERFACES)
        for iface in rv:
            rvm.pop(iface.interface_id, None)
        return _sort(rv), _sort([x() for x in rvm.values()])

    def get_interface(self, user, interface_id):
        interface = AUTHENTICATOR_INTERFACES.get(interface_id)
        if interface is None:
            raise Authenticator.DoesNotExist()
        try:
            return Authenticator.objects.get(
                user=user,
                type=interface.type,
            ).interface
        except Authenticator.DoesNotExist:
            return interface()

    def user_has_2fa(self, user):
        return Authenticator.objects.filter(user=user).first() is not None

    def validate_otp(self, user, otp):
        for interface in self.all_interfaces_for_user(user):
            if interface.validate_otp(otp):
                auth = interface.authenticator
                auth.last_used_at = timezone.now()
                auth.save()
                return True
        return False


AUTHENTICATOR_INTERFACES = {}
AUTHENTICATOR_INTERFACES_BY_TYPE = {}
AUTHENTICATOR_CHOICES = []


def register_authenticator(cls):
    AUTHENTICATOR_INTERFACES[cls.interface_id] = cls
    AUTHENTICATOR_INTERFACES_BY_TYPE[cls.type] = cls
    AUTHENTICATOR_CHOICES.append((cls.type, cls.name))
    return cls


class AuthenticatorInterface(object):
    type = -1
    interface_id = None
    name = None
    description = None
    enroll_button = _('Enroll')
    configure_button = _('Configure')
    remove_button = _('Remove')

    def __init__(self, authenticator=None):
        if authenticator is None:
            self.authenticator = None
        else:
            self.authenticator = authenticator

    @property
    def is_enrolled(self):
        return self.authenticator is not None

    @property
    def config(self):
        if self.authenticator is not None:
            return self.authenticator.config
        rv = getattr(self, '_unbound_config', None)
        if rv is None:
            rv = self._unbound_config = self.generate_new_config()
        return rv

    def generate_new_config(self):
        return {}

    def enroll(self, user):
        if self.authenticator is not None:
            raise RuntimeError('Already enrolled')
        self.authenticator = Authenticator.objects.create(
            user=user,
            type=self.type,
            config=self.config,
        )

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
    enroll_button = _('Activate')
    configure_button = _('View Codes')

    def __init__(self, authenticator=None):
        AuthenticatorInterface.__init__(self, authenticator)

    def get_codes(self):
        rv = []
        if self.is_enrolled:
            h = hmac.new(self.config['salt'], None, hashlib.sha1)
            for x in xrange(10):
                h.update('%s|' % x)
                rv.append(base64.b32encode(h.digest())[:8])
        return rv

    def generate_new_config(self):
        return {
            'salt': os.urandom(16).encode('hex'),
            'used': 0,
        }

    def validate_otp(self, otp):
        mask = self.config['used']
        code = otp.strip().replace('-', '').upper()
        for idx, ref_code in enumerate(self.get_codes()):
            if code == ref_code:
                if mask & (1 << idx):
                    break
                self.config['used'] = mask | (1 << idx)
                return True
        return False

    def get_unused_codes(self):
        mask = self.config['used']
        rv = []
        for idx, code in enumerate(self.get_codes()):
            if not mask & (1 << idx):
                rv.append(code[:4] + '-' + code[4:])
        return rv


@register_authenticator
class TotpInterface(AuthenticatorInterface):
    type = 1
    interface_id = 'totp'
    name = _('Authenticator App')
    description = _('An authenticator application that supports TOTP (like '
                    'Google Authenticator or 1Password) can be used to '
                    'conveniently secure your account.  A new token is '
                    'generated every 30 seconds.')

    def generate_new_config(self):
        return {
            'secret': generate_secret_key(),
        }

    def validate_otp(self, otp):
        return TOTP(self.config['secret']).verify(otp)

    def get_provision_qrcode(self, user, issuer=None):
        return TOTP(self.config['secret']).get_provision_qrcode(
            user, issuer=issuer)


class Authenticator(BaseModel):
    id = BoundedAutoField(primary_key=True)
    user = FlexibleForeignKey('sentry.User', db_index=True)
    created_at = models.DateTimeField(_('created at'), default=timezone.now)
    last_used_at = models.DateTimeField(_('last used at'), null=True)
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
        return AUTHENTICATOR_INTERFACES_BY_TYPE[self.type](self)

    def __repr__(self):
        return '<Authenticator user=%r interface=%r>' % (
            self.user.email,
            self.interface.interface_id,
        )

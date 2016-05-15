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
from sentry.utils.sms import send_sms, sms_available


class AuthenticatorManager(BaseManager):

    def all_interfaces_for_user(self, user, return_missing=False):
        """Returns a correctly sorted list of all interfaces the user
        has enabled.  If `return_missing` is set to `True` the return
        value is a tuple of `(enrolled, unenrolled)` interfaces.
        """
        _sort = lambda x: sorted(x, key=lambda x: (x.type == 0, x.type))
        rv = [x.interface for x in Authenticator.objects.filter(user=user)
              if x.interface.is_available]
        if not return_missing:
            return _sort(rv)
        rvm = dict(AUTHENTICATOR_INTERFACES)
        for iface in rv:
            rvm.pop(iface.interface_id, None)
        others = []
        for key, iface_cls in rvm.iteritems():
            iface = iface_cls()
            if iface.is_available:
                others.append(iface)
        return _sort(rv), _sort(others)

    def is_missing_backup_interfaces(self, user):
        """This checks if the user provided should add a backup interface
        to his account.  This returns `true` essentially if at least one
        non backup interface was added but not a single backup interface.
        """
        has_authenticators = False
        for authenticator in Authenticator.objects.filter(user=user):
            if not authenticator.interface.is_available:
                continue
            if authenticator.interface.backup_interface:
                return False
            has_authenticators = True
        return has_authenticators

    def get_interface(self, user, interface_id):
        """Looks up an interface by interface ID for a user.  If the
        interface is not available but configured a
        `Authenticator.DoesNotExist` will be raised just as if the
        authenticator was not configured at all.
        """
        interface = AUTHENTICATOR_INTERFACES.get(interface_id)
        if interface is None or not interface.is_available:
            raise LookupError('No such interface %r' % interface_id)
        try:
            return Authenticator.objects.get(
                user=user,
                type=interface.type,
            ).interface
        except Authenticator.DoesNotExist:
            return interface()

    def user_has_2fa(self, user, ignore_backup=False):
        """Checks if the user has any 2FA configured.  Optionally backup
        interfaces can be ignored.
        """
        if ignore_backup:
            for authenticator in Authenticator.objects.filter(user=user):
                if not authenticator.interface.is_available:
                    continue
                if not authenticator.interface.backup_interface:
                    return True
            return False
        return Authenticator.objects.filter(user=user).first() is not None

    def validate_otp(self, user, otp):
        """Validates an OTP response against all interfaces.  If any accepts
        it the success is logged and `True` is returned, `False` otherwise.
        """
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
    backup_interface = False
    enroll_button = _('Enroll')
    configure_button = _('Configure')
    remove_button = _('Remove')
    is_available = True

    def __init__(self, authenticator=None):
        if authenticator is None:
            self.authenticator = None
        else:
            self.authenticator = authenticator

    @property
    def is_enrolled(self):
        """Returns `True` if the interfaces is enrolled (eg: has an
        authenticator for a user attached).
        """
        return self.authenticator is not None

    @property
    def requires_activation(self):
        """If the interface has an activation method that needs to be
        called this returns `True`.
        """
        return self.activate.im_func is not \
            AuthenticatorInterface.activate.im_func

    @property
    def config(self):
        """Returns the configuration dictionary for this interface.  If
        the interface is registered with an authenticator (eg: it is
        enrolled) then the authenticator's config is returned, otherwise
        a new config is used on first access.
        """
        if self.authenticator is not None:
            return self.authenticator.config
        rv = getattr(self, '_unbound_config', None)
        if rv is None:
            rv = self._unbound_config = self.generate_new_config()
        return rv

    def generate_new_config(self):
        """This method is invoked if a new config is required."""
        return {}

    def activate(self, request):
        """If an authenticator overrides this then the method is called
        when the dialog for authentication is brought up.  The returned string
        is then rendered in the UI.
        """
        # This method needs to be empty for the default
        # `requires_activation` property to make sense.
        pass

    def enroll(self, user):
        """Invoked to enroll a user for this interface.  If already enrolled
        an error is raised.
        """
        if self.authenticator is not None:
            raise RuntimeError('Already enrolled')
        self.authenticator = Authenticator.objects.create(
            user=user,
            type=self.type,
            config=self.config,
        )

    def validate_otp(self, otp):
        """This method is invoked for an OTP response and has to return
        `True` or `False` based on the validity of the OTP response.
        """
        return False


@register_authenticator
class RecoveryCodeInterface(AuthenticatorInterface):
    """A backup interface that is based on static recovery codes."""
    type = 0
    interface_id = 'recovery'
    name = _('Recovery Codes')
    description = _('Recovery codes can be used to access your account in the '
                    'event you lose access to your device and cannot '
                    'receive two-factor authentication codes.')
    enroll_button = _('Activate')
    configure_button = _('View Codes')
    backup_interface = True

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


class OtpMixin(object):

    def generate_new_config(self):
        return {
            'secret': generate_secret_key(),
        }

    def _get_secret(self):
        return self.config['secret']

    def _set_secret(self, secret):
        self.config['secret'] = secret

    secret = property(_get_secret, _set_secret)
    del _get_secret, _set_secret

    def make_otp(self):
        return TOTP(self.secret)

    def validate_otp(self, otp):
        otp = otp.strip().replace('-', '').replace(' ', '')
        return self.make_otp().verify(otp)


@register_authenticator
class TotpInterface(OtpMixin, AuthenticatorInterface):
    """This interface uses TOTP with an authenticator."""
    type = 1
    interface_id = 'totp'
    name = _('Authenticator App')
    description = _('An authenticator application that supports TOTP (like '
                    'Google Authenticator or 1Password) can be used to '
                    'conveniently secure your account.  A new token is '
                    'generated every 30 seconds.')

    def get_provision_qrcode(self, user, issuer=None):
        return self.make_otp().get_provision_qrcode(
            user, issuer=issuer)


@register_authenticator
class SmsInterface(OtpMixin, AuthenticatorInterface):
    """This interface sends OTP codes via text messages to the user."""
    type = 2
    interface_id = 'sms'
    name = _('Text Message')
    description = _('This authenticator sends you text messages for '
                    'verification.  It\'s useful as a backup method '
                    'or when you do not have a phone that supports '
                    'an authenticator application.')

    @property
    def is_available(self):
        return sms_available()

    def generate_new_config(self):
        config = super(SmsInterface, self).generate_new_config()
        config['phone_number'] = None
        return config

    def make_otp(self):
        return TOTP(self.config['secret'], digits=4, interval=60)

    def _get_phone_number(self):
        return self.config['phone_number']

    def _set_phone_number(self, value):
        self.config['phone_number'] = value

    phone_number = property(_get_phone_number, _set_phone_number)
    del _get_phone_number, _set_phone_number

    def activate(self, request):
        if self.send_text():
            return _('A confirmation code was sent to your phone.')
        return _('Error: we failed to send a text message to you.  You '
                 'can try again later or sign in with a different method.')

    def send_text(self):
        code = self.make_totp().generate_otp()
        return send_sms('Your Sentry authentication code is %s.' % code,
                        to=self.phone_number)


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

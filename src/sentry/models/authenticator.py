"""
sentry.models.authenticator
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os
import hmac
import time
import base64
import hashlib
import six

from u2flib_server import u2f
from u2flib_server import jsapi as u2f_jsapi

from cryptography.exceptions import InvalidSignature, InvalidKey

from django.db import models
from django.core.cache import cache
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from django.utils.functional import cached_property
from django.core.urlresolvers import reverse

from sentry import options
from sentry.db.models import BaseManager, BaseModel, BoundedAutoField, \
    FlexibleForeignKey, BoundedPositiveIntegerField, UnicodePickledObjectField
from sentry.utils.decorators import classproperty
from sentry.utils.otp import generate_secret_key, TOTP
from sentry.utils.sms import send_sms, sms_available
from sentry.utils.dates import to_datetime
from sentry.utils.http import absolute_uri


class ActivationResult(object):
    type = None


class ActivationMessageResult(ActivationResult):

    def __init__(self, message, type='info'):
        assert type in ('error', 'warning', 'info')
        self.type = type
        self.message = message


class ActivationChallengeResult(ActivationResult):
    type = 'challenge'

    def __init__(self, challenge):
        self.challenge = challenge


class AuthenticatorManager(BaseManager):

    def all_interfaces_for_user(self, user, return_missing=False):
        """Returns a correctly sorted list of all interfaces the user
        has enabled.  If `return_missing` is set to `True` then all
        interfaces are returned even if not enabled.
        """
        _sort = lambda x: sorted(x, key=lambda x: (x.type == 0, x.type))

        # Collect interfaces user is enrolled in
        ifaces = [x.interface for x in Authenticator.objects.filter(
            user=user,
            type__in=[a.type for a in available_authenticators()],
        )]

        if return_missing:
            # Collect additional interfaces that the user
            # is not enrolled in
            rvm = dict(AUTHENTICATOR_INTERFACES)
            for iface in ifaces:
                rvm.pop(iface.interface_id, None)
            for iface_cls in six.itervalues(rvm):
                if iface_cls.is_available:
                    ifaces.append(iface_cls())

        return _sort(ifaces)

    def auto_add_recovery_codes(self, user, force=False):
        """This automatically adds the recovery code backup interface in
        case no backup interface is currently set for the user.  Returns
        the interface that was added.
        """
        has_authenticators = False

        # If we're not forcing, check for a backup interface already setup
        # or if it's missing, we'll need to set it.
        if not force:
            for authenticator in Authenticator.objects.filter(
                user=user,
                type__in=[a.type for a in available_authenticators()]
            ):
                iface = authenticator.interface
                if iface.is_backup_interface:
                    return
                has_authenticators = True

        if has_authenticators or force:
            interface = RecoveryCodeInterface()
            interface.enroll(user)
            return interface

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

    def user_has_2fa(self, user):
        """Checks if the user has any 2FA configured.
        """
        return Authenticator.objects.filter(
            user=user,
            type__in=[a.type for a in available_authenticators(ignore_backup=True)],
        ).exists()

    def bulk_users_have_2fa(self, user_ids):
        """Checks if a list of user ids have 2FA configured.
        Returns a dict of {<id>: <has_2fa>}
        """
        authenticators = set(Authenticator.objects.filter(
            user__in=user_ids,
            type__in=[a.type for a in available_authenticators(ignore_backup=True)],
        ).distinct().values_list('user_id', flat=True))
        return {id: id in authenticators for id in user_ids}


AUTHENTICATOR_INTERFACES = {}
AUTHENTICATOR_INTERFACES_BY_TYPE = {}
AUTHENTICATOR_CHOICES = []


def register_authenticator(cls):
    AUTHENTICATOR_INTERFACES[cls.interface_id] = cls
    AUTHENTICATOR_INTERFACES_BY_TYPE[cls.type] = cls
    AUTHENTICATOR_CHOICES.append((cls.type, cls.name))
    return cls


def available_authenticators(ignore_backup=False):
    interfaces = six.itervalues(AUTHENTICATOR_INTERFACES)
    if not ignore_backup:
        return [v for v in interfaces if v.is_available]
    return [v for v in interfaces if not v.is_backup_interface and v.is_available]


class AuthenticatorInterface(object):
    type = -1
    interface_id = None
    name = None
    description = None
    is_backup_interface = False
    enroll_button = _('Enroll')
    configure_button = _('Info')
    remove_button = _('Remove')
    is_available = True
    allow_multi_enrollment = False

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
    def can_validate_otp(self):
        """If the interface is able to validate OTP codes then this returns
        `True`.
        """
        return self.validate_otp.im_func is not \
            AuthenticatorInterface.validate_otp.im_func

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
            # Prevent bad recursion if stuff wants to access the default
            # config
            self._unbound_config = {}
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
        if self.authenticator is None:
            self.authenticator = Authenticator.objects.create(
                user=user,
                type=self.type,
                config=self.config,
            )
        else:
            if not self.allow_multi_enrollment:
                raise Authenticator.AlreadyEnrolled()
            self.authenticator.config = self.config
            self.authenticator.save()

    def validate_otp(self, otp):
        """This method is invoked for an OTP response and has to return
        `True` or `False` based on the validity of the OTP response.  Note
        that this can be called with otp responses from other interfaces.
        """
        return False

    def validate_response(self, request, challenge, response):
        """If the activation generates a challenge that needs to be
        responded to this validates the response for that challenge.  This
        is only ever called for challenges emitted by the activation of this
        activation interface.
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
    remove_button = None
    is_backup_interface = True

    def __init__(self, authenticator=None):
        AuthenticatorInterface.__init__(self, authenticator)

    def get_codes(self):
        rv = []
        if self.is_enrolled:
            h = hmac.new(
                key=self.config['salt'].encode('utf-8'),
                msg=None,
                digestmod=hashlib.sha1,
            )
            for x in range(10):
                h.update('%s|' % x)
                rv.append(base64.b32encode(h.digest())[:8])
        return rv

    def generate_new_config(self):
        return {
            'salt': os.urandom(16).encode('hex'),
            'used': 0,
        }

    def regenerate_codes(self, save=True):
        if not self.is_enrolled:
            raise RuntimeError('Interface is not enrolled')
        self.config.update(self.generate_new_config())
        if save:
            self.authenticator.save()

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

    def _get_otp_counter_cache_key(self, counter):
        if self.authenticator is not None:
            return 'used-otp-counters:%s:%s' % (
                self.authenticator.user_id,
                counter,
            )

    def check_otp_counter(self, counter):
        # OTP uses an internal counter that increments every 30 seconds.
        # A hash function generates a six digit code based on the counter
        # and a secret key.  If the generated PIN was used it is marked in
        # redis as used by remembering which counter it was generated
        # from.  This is what we check for here.
        cache_key = self._get_otp_counter_cache_key(counter)
        return cache_key is None or cache.get(cache_key) != '1'

    def mark_otp_counter_used(self, counter):
        cache_key = self._get_otp_counter_cache_key(counter)
        if cache_key is not None:
            # Mark us used for three windows
            cache.set(cache_key, '1', timeout=120)

    def validate_otp(self, otp):
        otp = otp.strip().replace('-', '').replace(' ', '')
        used_counter = self.make_otp().verify(
            otp, return_counter=True,
            check_counter_func=self.check_otp_counter)
        if used_counter is not None:
            self.mark_otp_counter_used(used_counter)
            return True
        return False


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
    code_ttl = 45

    @classproperty
    def is_available(cls):
        return sms_available()

    def generate_new_config(self):
        config = super(SmsInterface, self).generate_new_config()
        config['phone_number'] = None
        return config

    def make_otp(self):
        return TOTP(self.config['secret'], digits=6, interval=self.code_ttl,
                    default_window=1)

    def _get_phone_number(self):
        return self.config['phone_number']

    def _set_phone_number(self, value):
        self.config['phone_number'] = value

    phone_number = property(_get_phone_number, _set_phone_number)
    del _get_phone_number, _set_phone_number

    def activate(self, request):
        if self.send_text(request=request):
            return ActivationMessageResult(
                _('A confirmation code was sent to your phone. '
                  'It is valid for %d seconds.') % self.code_ttl)
        return ActivationMessageResult(
            _('Error: we failed to send a text message to you. You '
              'can try again later or sign in with a different method.'),
            type='error')

    def send_text(self, for_enrollment=False, request=None):
        ctx = {'code': self.make_otp().generate_otp()}

        if for_enrollment:
            text = _('%(code)s is your Sentry two-factor enrollment code. '
                     'You are about to set up text message based two-factor '
                     'authentication.')
        else:
            text = _('%(code)s is your Sentry authentication code.')

        if request is not None:
            text = u'%s\n\n%s' % (text, _('Requested from %(ip)s'))
            ctx['ip'] = request.META['REMOTE_ADDR']

        return send_sms(text % ctx, to=self.phone_number)


@register_authenticator
class U2fInterface(AuthenticatorInterface):
    type = 3
    interface_id = 'u2f'
    configure_button = _('Configure')
    name = _('U2F (Universal 2nd Factor)')
    description = _('Authenticate with a U2F hardware device. This is a '
                    'device like a Yubikey or something similar which '
                    'supports FIDO\'s U2F specification. This also requires '
                    'a browser which supports this system (like Google '
                    'Chrome).')
    allow_multi_enrollment = True

    @classproperty
    def u2f_app_id(cls):
        rv = options.get('u2f.app-id')
        return rv or absolute_uri(reverse('sentry-u2f-app-id'))

    @classproperty
    def u2f_facets(cls):
        facets = options.get('u2f.facets')
        if not facets:
            return [options.get('system.url-prefix')]
        return [x.rstrip('/') for x in facets]

    @classproperty
    def is_available(cls):
        url_prefix = options.get('system.url-prefix')
        return url_prefix and url_prefix.startswith('https://')

    def generate_new_config(self):
        return {}

    def start_enrollment(self):
        return dict(u2f.start_register(self.u2f_app_id,
                                       self.get_u2f_devices()))

    def get_u2f_devices(self):
        rv = []
        for data in self.config.get('devices') or ():
            rv.append(u2f_jsapi.DeviceRegistration(data['binding']))
        return rv

    def remove_u2f_device(self, key):
        """Removes a U2F device but never removes the last one.  This returns
        False if the last device would be removed.
        """
        devices = [x for x in self.config.get('devices') or ()
                   if x['binding']['keyHandle'] != key]
        if devices:
            self.config['devices'] = devices
            return True
        return False

    def get_registered_devices(self):
        rv = []
        for device in self.config.get('devices') or ():
            rv.append({
                'timestamp': to_datetime(device['ts']),
                'name': device['name'],
                'key_handle': device['binding']['keyHandle'],
                'app_id': device['binding']['appId'],
            })
        rv.sort(key=lambda x: x['name'])
        return rv

    def try_enroll(self, enrollment_data, response_data, device_name=None):
        binding, cert = u2f.complete_register(enrollment_data, response_data,
                                              self.u2f_facets)
        devices = self.config.setdefault('devices', [])
        devices.append({
            'name': device_name or 'Security Key',
            'ts': int(time.time()),
            'binding': dict(binding),
        })

    def activate(self, request):
        return ActivationChallengeResult(
            challenge=dict(u2f.start_authenticate(self.get_u2f_devices())),
        )

    def validate_response(self, request, challenge, response):
        try:
            counter, touch = u2f.verify_authenticate(self.get_u2f_devices(),
                                                     challenge, response,
                                                     self.u2f_facets)
        except (InvalidSignature, InvalidKey, StopIteration):
            return False
        return True


class Authenticator(BaseModel):
    __core__ = True

    id = BoundedAutoField(primary_key=True)
    user = FlexibleForeignKey('sentry.User', db_index=True)
    created_at = models.DateTimeField(_('created at'), default=timezone.now)
    last_used_at = models.DateTimeField(_('last used at'), null=True)
    type = BoundedPositiveIntegerField(choices=AUTHENTICATOR_CHOICES)
    config = UnicodePickledObjectField()

    objects = AuthenticatorManager()

    class AlreadyEnrolled(Exception):
        pass

    class Meta:
        app_label = 'sentry'
        db_table = 'auth_authenticator'
        verbose_name = _('authenticator')
        verbose_name_plural = _('authenticators')

    @cached_property
    def interface(self):
        return AUTHENTICATOR_INTERFACES_BY_TYPE[self.type](self)

    def mark_used(self, save=True):
        self.last_used_at = timezone.now()
        if save:
            self.save()

    def __repr__(self):
        return '<Authenticator user=%r interface=%r>' % (
            self.user.email,
            self.interface.interface_id,
        )

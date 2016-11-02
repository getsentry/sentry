"""
sentry.utils.auth
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six
import logging
from time import time

from django.conf import settings
from django.contrib.auth import login as _login
from django.contrib.auth.backends import ModelBackend
from django.core.urlresolvers import reverse, resolve
from sudo.utils import is_safe_url

from sentry.models import User, Authenticator

logger = logging.getLogger('sentry.auth')

_LOGIN_URL = None

SSO_SESSION_KEY = 'sso'

MFA_SESSION_KEY = 'mfa'


class AuthUserPasswordExpired(Exception):

    def __init__(self, user):
        self.user = user


def _make_key_value(val):
    return val.strip().split('=', 1)


def parse_auth_header(header):
    try:
        return dict(map(_make_key_value, header.split(' ', 1)[1].split(',')))
    except Exception:
        return {}


def get_auth_providers():
    return [
        key for key, cfg_names
        in six.iteritems(settings.AUTH_PROVIDERS)
        if all(getattr(settings, c, None) for c in cfg_names)
    ]


def get_pending_2fa_user(request):
    rv = request.session.get('_pending_2fa')
    if rv is None:
        return

    user_id, created_at = rv[:2]
    if created_at < time() - 60 * 5:
        return None

    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        pass


def has_pending_2fa(request):
    return request.session.get('_pending_2fa') is not None


def get_login_url(reset=False):
    global _LOGIN_URL

    if _LOGIN_URL is None or reset:
        # if LOGIN_URL resolves force login_required to it instead of our own
        # XXX: this must be done as late as possible to avoid idempotent requirements
        try:
            resolve(settings.LOGIN_URL)
        except Exception:
            _LOGIN_URL = settings.SENTRY_LOGIN_URL
        else:
            _LOGIN_URL = settings.LOGIN_URL

        if _LOGIN_URL is None:
            _LOGIN_URL = reverse('sentry-login')
    return _LOGIN_URL


def initiate_login(request, next_url=None):
    try:
        del request.session['_after_2fa']
    except KeyError:
        pass

    try:
        del request.session['_pending_2fa']
    except KeyError:
        pass

    if next_url:
        request.session['_next'] = next_url
    else:
        try:
            del request.session['_next']
        except KeyError:
            pass


def get_login_redirect(request, default=None):
    if default is None:
        default = get_login_url()

    # If there is a pending 2fa authentication bound to the session then
    # we need to go to the 2fa dialog.
    if has_pending_2fa(request):
        return reverse('sentry-2fa-dialog')

    # If we have a different URL to go after the 2fa flow we want to go to
    # that now here.
    after_2fa = request.session.pop('_after_2fa', None)
    if after_2fa is not None:
        return after_2fa

    login_url = request.session.pop('_next', None)
    if not login_url:
        return default

    if not is_valid_redirect(login_url, host=request.get_host()):
        login_url = default

    return login_url


def is_valid_redirect(url, host=None):
    if not url:
        return False
    if url.startswith(get_login_url()):
        return False
    return is_safe_url(url, host=host)


def mark_sso_complete(request, organization_id):
    # TODO(dcramer): this needs to be bound based on SSO options (e.g. changing
    # or enabling SSO invalidates this)
    sso = request.session.get(SSO_SESSION_KEY, '')
    if sso:
        sso = sso.split(',')
    else:
        sso = []
    sso.append(six.text_type(organization_id))
    request.session[SSO_SESSION_KEY] = ','.join(sso)
    request.session.modified = True


def has_completed_sso(request, organization_id):
    sso = request.session.get(SSO_SESSION_KEY, '').split(',')
    return six.text_type(organization_id) in sso


def find_users(username, with_valid_password=True, is_active=None):
    """
    Return a list of users that match a username
    and falling back to email
    """
    qs = User.objects

    if is_active is not None:
        qs = qs.filter(is_active=is_active)

    if with_valid_password:
        qs = qs.exclude(password='!')

    try:
        # First, assume username is an iexact match for username
        user = qs.get(username__iexact=username)
        return [user]
    except User.DoesNotExist:
        # If not, we can take a stab at guessing it's an email address
        if '@' in username:
            # email isn't guaranteed unique
            return list(qs.filter(email__iexact=username))
    return []


def login(request, user, passed_2fa=None, after_2fa=None,
          organization_id=None):
    """
    This logs a user in for the sesion and current request.

    If 2FA is enabled this method will start the MFA flow and return False as
    required.  If `passed_2fa` is set to `True` then the 2FA flow is set to be
    finalized (user passed the flow).

    If the session has already resolved MFA in the past, it will automatically
    detect it from the session.

    Optionally `after_2fa` can be set to a URL which will be used to override
    the regular session redirect target directly after the 2fa flow.

    Returns boolean indicating if the user was logged in.
    """
    has_2fa = Authenticator.objects.user_has_2fa(user)
    if passed_2fa is None:
        passed_2fa = (
            request.session.get(MFA_SESSION_KEY, '') == six.text_type(user.id)
        )

    if has_2fa and not passed_2fa:
        request.session['_pending_2fa'] = [user.id, time(), organization_id]
        if after_2fa is not None:
            request.session['_after_2fa'] = after_2fa
        request.session.modified = True
        return False

    # TODO(dcramer): this needs to be bound based on MFA options
    if passed_2fa:
        request.session[MFA_SESSION_KEY] = six.text_type(user.id)
        request.session.modified = True

    mfa_state = request.session.pop('_pending_2fa', ())
    if organization_id is None and len(mfa_state) == 3:
        organization_id = mfa_state[2]

    # Check for expired passwords here after we cleared the 2fa flow.
    # While this means that users will have to pass 2fa before they can
    # figure out that their passwords are expired this is still the more
    # reasonable behavior.
    #
    # We also rememebr _after_2fa here so that we can continue the flow if
    # someone does it in the same browser.
    if user.is_password_expired:
        raise AuthUserPasswordExpired(user)

    # If this User has a nonce value, we need to bind into the session.
    if user.session_nonce is not None:
        request.session['_nonce'] = user.session_nonce

    # If there is no authentication backend, just attach the first
    # one and hope it goes through.  This apparently is a thing we
    # have been doing for a long time, just moved it to a more
    # reasonable place.
    if not hasattr(user, 'backend'):
        user.backend = settings.AUTHENTICATION_BACKENDS[0]
    _login(request, user)
    if organization_id:
        mark_sso_complete(request, organization_id)
    log_auth_success(request, user.username, organization_id)
    return True


def log_auth_success(request, username, organization_id=None):
    logger.info('user.auth.success', extra={
        'ip_address': request.META['REMOTE_ADDR'],
        'username': username,
        'organization_id': organization_id,
    })


def log_auth_failure(request, username=None):
    logger.info('user.auth.fail', extra={
        'ip_address': request.META['REMOTE_ADDR'],
        'username': username,
    })


class EmailAuthBackend(ModelBackend):
    """
    Authenticate against django.contrib.auth.models.User.

    Supports authenticating via an email address or a username.
    """
    def authenticate(self, username=None, password=None):
        users = find_users(username)
        if users:
            for user in users:
                try:
                    if user.password and user.check_password(password):
                        return user
                except ValueError:
                    continue
        return None

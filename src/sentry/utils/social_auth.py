"""
sentry.utils.social_auth
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings

from social_auth.backends.pipeline.user import create_user
from social_auth.exceptions import SocialAuthBaseException


class AuthNotAllowed(SocialAuthBaseException):
    pass


def create_user_if_enabled(*args, **kwargs):
    """
    A pipeline step for django-social-auth
    Create user. Depends on get_username pipeline.
    """
    if not settings.SOCIAL_AUTH_CREATE_USERS and not kwargs.get('user'):
        raise AuthNotAllowed('You must create an account before associating an identity.')

    backend = kwargs.pop('backend')
    details = kwargs.pop('details')
    response = kwargs.pop('response')
    uid = kwargs.pop('uid')
    username = kwargs.pop('username', None)
    user = kwargs.pop('user', None)

    return create_user(backend=backend, details=details, response=response, uid=uid, username=username, user=user, *args, **kwargs)

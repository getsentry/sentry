"""
sentry.interfaces.user
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

__all__ = ('User',)

from sentry.interfaces.base import Interface
from sentry.utils.safe import trim, trim_dict
from sentry.web.helpers import render_to_string
from ipaddr import IPAddress


def validate_ip(value, required=True):
    if not required and not value:
        return

    # will raise a ValueError
    IPAddress(value)
    return value


class User(Interface):
    """
    An interface which describes the authenticated User for a request.

    You should provide **at least** either an `id` (a unique identifier for
    an authenticated user) or `ip_address` (their IP address).

    All other attributes are optional.

    >>> {
    >>>     "id": "unique_id",
    >>>     "username": "my_user",
    >>>     "email": "foo@example.com"
    >>>     "ip_address": "127.0.0.1",
    >>>     "optional": "value"
    >>> }
    """
    @classmethod
    def to_python(cls, data):
        data = data.copy()

        extra_data = data.pop('data', data)
        if not isinstance(extra_data, dict):
            extra_data = {}

        kwargs = {
            'id': trim(data.pop('id', None), 128),
            'email': trim(data.pop('email', None), 128),
            'username': trim(data.pop('username', None), 128),
            'ip_address': validate_ip(data.pop('ip_address', None), False),
        }

        kwargs['data'] = trim_dict(extra_data)
        return cls(**kwargs)

    def get_api_context(self, is_public=False):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'ipAddress': self.ip_address,
            'data': self.data,
        }

    def get_path(self):
        return 'sentry.interfaces.User'

    def get_hash(self):
        return []

    def to_email_html(self, event, **kwargs):
        context = {
            'user_id': self.id,
            'user_email': self.email,
            'user_username': self.username,
            'user_ip_address': self.ip_address,
            'user_data': self.data,
        }
        return render_to_string('sentry/partial/interfaces/user_email.html', context)

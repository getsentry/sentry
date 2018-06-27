"""
sentry.interfaces.user
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

__all__ = ('User', )

import six

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.interfaces.geo import Geo
from sentry.utils.safe import trim, trim_dict
from sentry.web.helpers import render_to_string
from sentry.utils.validators import validate_ip
from sentry.constants import MAX_EMAIL_FIELD_LENGTH


def validate_email(value, required=True):
    if not required and not value:
        return

    if not isinstance(value, six.string_types):
        raise ValueError('object of type %r is not an email address' % type(value).__name__)

    # safe to assume an email address at least has a @ in it.
    if '@' not in value:
        raise ValueError('malformed email address')
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

        ident = data.pop('id', None)
        if ident:
            ident = trim(six.text_type(ident), 128)
        try:
            email = trim(validate_email(data.pop('email', None), False), MAX_EMAIL_FIELD_LENGTH)
        except ValueError:
            raise InterfaceValidationError("Invalid value for 'email'")

        username = trim(data.pop('username', None), 128)
        if username:
            username = six.text_type(username)

        name = trim(data.pop('name', None), 128)
        if name:
            name = six.text_type(name)

        try:
            ip_address = validate_ip(data.pop('ip_address', None), False)
        except ValueError:
            raise InterfaceValidationError("Invalid value for 'ip_address'")

        geo = data.pop('geo', None)
        if not geo and ip_address:
            geo = Geo.from_ip_address(ip_address)
        elif geo:
            geo = Geo.to_python(geo)

        # TODO(dcramer): patch in fix to deal w/ old data but not allow new
        # if not (ident or email or username or ip_address):
        #     raise ValueError('No identifying value')

        kwargs = {
            'id': ident,
            'email': email,
            'username': username,
            'ip_address': ip_address,
            'name': name,
            'geo': geo,
        }

        kwargs['data'] = trim_dict(extra_data)
        return cls(**kwargs)

    def to_json(self):
        # geo needs to be JSON encoded if it exists
        geo = self._data.pop('geo') if 'geo' in self._data else {}
        json = super(User, self).to_json()
        if geo:
            json['geo'] = geo.to_json()
        return json

    def get_api_context(self, is_public=False):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'ipAddress': self.ip_address,
            'name': self.name,
            'data': self.data,
        }

    def get_path(self):
        return 'sentry.interfaces.User'

    def get_hash(self):
        return []

    def get_display_name(self):
        return self.email or self.username

    def get_label(self):
        return self.name or self.email or self.username or self.id or self.ip_address

    def to_email_html(self, event, **kwargs):
        context = {
            'user_id': self.id,
            'user_email': self.email,
            'user_username': self.username,
            'user_ip_address': self.ip_address,
            'user_data': self.data,
            'user': self,
        }
        return render_to_string('sentry/partial/interfaces/user_email.html', context)

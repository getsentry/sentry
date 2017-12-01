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
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.utils.safe import trim, trim_dict
from sentry.web.helpers import render_to_string


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
    path = 'sentry.interfaces.User'

    @classmethod
    def to_python(cls, data):
        data = data.copy()
        # pre-validation casting
        for k in {'id', 'email', 'username', 'ip_address', 'name'}:
            if k in data and data[k]:
                data[k] = six.text_type(data[k])

        orig = data.copy()
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid user")

        if 'data' in data:
            body_data = data['data']
        else:
            # Any keys that were in the original but were removed by
            # the schema get put into 'data' (for backwards compatibility).
            body_data = {k: v for k, v in six.iteritems(orig) if k not in data and v}
        data['data'] = trim_dict(body_data) if isinstance(body_data, dict) else {}

        trim_keys = {'id', 'email', 'username', 'name', 'ip_address'}
        data.update({k: trim(data.get(k, None), 128) for k in trim_keys})

        return cls(**data)

    def get_path(self):
        return self.path

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

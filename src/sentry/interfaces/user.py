"""
sentry.interfaces.user
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

__all__ = ('User', )

import six

from sentry.interfaces.base import Interface, prune_empty_keys, RUST_RENORMALIZED_DEFAULT
from sentry.interfaces.geo import Geo
from sentry.utils.safe import trim, trim_dict
from sentry.web.helpers import render_to_string
from sentry.utils.validators import validate_ip
from sentry.constants import MAX_EMAIL_FIELD_LENGTH


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

    score = 1
    display_score = 2020

    @classmethod
    def to_python(cls, data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        if rust_renormalized:
            data = data.copy()
            for key in (
                'id',
                'email',
                'username',
                'ip_address',
                'name',
                'geo',
                'data',
            ):
                data.setdefault(key, None)
            if data['geo'] is not None:
                data['geo'] = Geo.to_python(data['geo'])
            return cls(**data)

        data = data.copy()

        ident = data.pop('id', None)
        if ident is not None:
            ident = trim(six.text_type(ident), 128)

        email = data.pop('email', None)
        if not isinstance(email, six.string_types):
            email = None
        email = trim(email, MAX_EMAIL_FIELD_LENGTH)

        username = data.pop('username', None)
        if username is not None:
            username = trim(six.text_type(username), 128)

        name = data.pop('name', None)
        if name is not None:
            name = trim(six.text_type(name), 128)

        try:
            ip_address = validate_ip(data.pop('ip_address', None), False)
        except ValueError:
            ip_address = None

        geo = data.pop('geo', None)
        if not geo and ip_address:
            geo = Geo.from_ip_address(ip_address)
        elif geo:
            geo = Geo.to_python(geo)

        extra_data = data.pop('data', None)
        if not isinstance(extra_data, dict):
            extra_data = {}
        extra_data.update(data)

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
            'data': trim_dict(extra_data)
        }

        return cls(**kwargs)

    def to_json(self):
        return prune_empty_keys({
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'ip_address': self.ip_address,
            'name': self.name,
            'geo': self.geo.to_json() if self.geo is not None else None,
            'data': self.data or None
        })

    def get_api_context(self, is_public=False):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'ip_address': self.ip_address,
            'name': self.name,
            'data': self.data,
        }

    def get_api_meta(self, meta, is_public=False):
        return {
            '': meta.get(''),
            'id': meta.get('id'),
            'email': meta.get('email'),
            'username': meta.get('username'),
            'ip_address': meta.get('ip_address'),
            'name': meta.get('name'),
            'data': meta.get('data'),
        }

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

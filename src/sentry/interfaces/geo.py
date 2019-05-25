from __future__ import absolute_import

__all__ = ('Geo', )

import six

from sentry.interfaces.base import Interface, RUST_RENORMALIZED_DEFAULT
from sentry.utils.geo import geo_by_addr


class Geo(Interface):
    """
    The (approximate) geographical location of the end user.

    >>> {
    >>>     'country_code': 'US',
    >>>     'city': 'San Francisco',
    >>>     'region': 'CA',
    >>> }
    """

    @classmethod
    def to_python(cls, data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        data = {
            'country_code': data.get('country_code'),
            'city': data.get('city'),
            'region': data.get('region'),
        }

        return cls(**data)

    @classmethod
    def from_ip_address(cls, ip_address):
        try:
            geo = geo_by_addr(ip_address)
        except Exception:
            geo = None

        if not geo:
            return None

        data = {}
        for k in ('country_code', 'city', 'region'):
            d = geo.get(k)

            if isinstance(d, six.binary_type):
                d = d.decode('ISO-8859-1')

            data[k] = d

        return cls.to_python(data)

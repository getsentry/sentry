from __future__ import absolute_import

from .base import Filter

LOCAL_IPS = frozenset(['127.0.0.1', '::1'])


class LocalhostFilter(Filter):
    id = 'localhost'
    name = 'Filter out errors coming from localhost'
    description = 'This applies to to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.'

    def get_ip_address(self, data):
        try:
            return data['sentry.interfaces.User']['ip_address']
        except KeyError:
            return ''

    def test(self, data):
        return self.get_ip_address(data) in LOCAL_IPS

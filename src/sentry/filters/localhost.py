from __future__ import absolute_import

from .base import Filter


class LocalhostFilter(Filter):
    id = 'localhost'
    name = 'Filter out errors coming from localhost'

    def get_ip_address(self, data):
        try:
            return data['sentry.interfaces.User']['ip_address']
        except KeyError:
            return ''

    def test(self, data):
        return self.get_ip_address(data) == '127.0.0.1'

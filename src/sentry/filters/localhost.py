from __future__ import absolute_import

import re

from .base import Filter

LOCAL_IPS = frozenset(['127.0.0.1', '::1'])
LOCAL_DOMAINS = frozenset(['127.0.0.1', 'localhost'])
DOMAIN_FROM_URL = re.compile(r'.*?\:\/\/?([^\/\?#:]+).*')


class LocalhostFilter(Filter):
    id = 'localhost'
    name = 'Filter out errors coming from localhost'
    description = 'This applies to to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses as well as ``127.0.0.1`` and ``localhost`` domains.'

    def get_ip_address(self, data):
        try:
            return data['sentry.interfaces.User']['ip_address']
        except KeyError:
            return ''
    
    def get_url(self, data):
        try:
            http = data['sentry.interfaces.Http']
            if http:
                return ['url']
            return ''
        except KeyError:
            return ''
    
    def get_domain(self, data):
        matchObj = DOMAIN_FROM_URL.match(self.get_url(data))
        if matchObj:
            return matchObj.group(1) or ''
        return ''

    def test(self, data):
        return self.get_ip_address(data) in LOCAL_IPS or self.get_domain(data) in LOCAL_DOMAINS

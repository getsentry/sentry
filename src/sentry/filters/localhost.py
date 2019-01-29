from __future__ import absolute_import

from .base import Filter
from six.moves.urllib.parse import urlparse
from sentry.utils.data_filters import FilterStatKeys
from sentry.utils.safe import get_path

LOCAL_IPS = frozenset(['127.0.0.1', '::1'])
LOCAL_DOMAINS = frozenset(['127.0.0.1', 'localhost'])


class LocalhostFilter(Filter):
    id = FilterStatKeys.LOCALHOST
    name = 'Filter out events coming from localhost'
    description = 'This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.'

    def get_ip_address(self, data):
        return get_path(data, 'user', 'ip_address') or ''

    def get_url(self, data):
        return get_path(data, 'request', 'url') or ''

    def get_domain(self, data):
        return urlparse(self.get_url(data)).hostname

    def test(self, data):
        return self.get_ip_address(data) in LOCAL_IPS or self.get_domain(data) in LOCAL_DOMAINS

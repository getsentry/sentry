from httplib import HTTPConnection, HTTPSConnection
from urllib import urlencode
from urlparse import urlparse
import socket


class Replayer(object):
    def __init__(self, url, method, data=None, headers=None):
        self.url = url
        self.method = method
        self.data = data
        self.headers = headers

    def replay(self):
        urlparts = urlparse(self.url)
        if urlparts.scheme == 'http':
            conn_cls = HTTPConnection
        elif urlparts.scheme == 'https':
            conn_cls = HTTPSConnection
        else:
            raise ValueError(self.url)

        data = self.data
        if isinstance(data, dict):
            data = urlencode(data)

        conn = conn_cls(urlparts.netloc, timeout=5)
        try:
            conn.request(self.method, urlparts.path, data, self.headers or {})

            response = conn.getresponse()
        except socket.error, e:
            return {
                'status': 'error',
                'reason': str(e),
            }

        return {
            'status': response.status,
            'reason': response.reason,
            'headers': response.getheaders(),
            'body': response.read(),
        }

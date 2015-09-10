from __future__ import absolute_import
from requests import RequestException
from sentry.http import safe_urlopen


class Replayer(object):
    def __init__(self, url, method, data=None, headers=None):
        self.url = url
        self.method = method
        self.data = data
        self.headers = headers

    def replay(self):
        try:
            response = safe_urlopen(
                url=self.url,
                method=self.method,
                data=self.data,
                headers=self.headers or {}
            )
        except RequestException as e:
            return {
                'status': 'error',
                'reason': str(e),
            }

        return {
            'status': response.status_code,
            'reason': response.reason,
            'headers': response.headers,
            'body': response.content,
        }

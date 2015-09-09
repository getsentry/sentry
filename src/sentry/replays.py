from __future__ import absolute_import
import requests


class Replayer(object):
    def __init__(self, url, method, data=None, headers=None):
        self.url = url
        self.method = method
        self.data = data
        self.headers = headers

    def replay(self):
        try:
            response = requests.request(
                self.method,
                self.url,
                data=self.data,
                headers=self.headers or {}
            )
        except requests.RequestException as e:
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

from __future__ import absolute_import

__all__ = ('ApiClient',)

from rest_framework.test import APIClient as DefaultAPIClient

from sentry.utils import json


class ApiError(Exception):
    def __init__(self, status_code, body):
        self.status_code = status_code
        self.body = body

    def __unicode__(self):
        return 'status=%s body=%s' % (self.status_code, self.body)

    @property
    def status(self):
        return self.status_code


class ApiClient(object):
    prefix = '/api/0'

    ApiError = ApiError

    def request(self, method, path, user, auth=None, params=None, data=None,
                is_sudo=False):
        full_path = self.prefix + path

        if data:
            # we encode to ensure compatibility
            data = json.loads(json.dumps(data))

        # TODO(dcramer): implement is_sudo
        client = DefaultAPIClient()
        client.force_authenticate(user, auth)

        response = getattr(client, method.lower())(full_path, data)

        if 200 <= response.status_code < 400:
            return response
        raise self.ApiError(response.status_code, response.data)

    def get(self, *args, **kwargs):
        return self.request('GET', *args, **kwargs)

    def post(self, *args, **kwargs):
        return self.request('POST', *args, **kwargs)

    def put(self, *args, **kwargs):
        return self.request('PUT', *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self.request('DELETE', *args, **kwargs)

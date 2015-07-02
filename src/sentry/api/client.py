from __future__ import absolute_import

__all__ = ('ApiClient',)

from rest_framework.test import (
    APIClient as DefaultRequestClient, ForceAuthClientHandler
)

from sentry.utils import json


class ApiError(Exception):
    def __init__(self, status_code, body):
        self.status_code = status_code
        self.body = body

    def __unicode__(self):
        return u'status=%s body=%s' % (self.status_code, self.body)

    def __str__(self):
        return unicode(self).encode('utf-8')

    @property
    def status(self):
        return self.status_code


class ApiClientHandler(ForceAuthClientHandler):
    def __init__(self, is_sudo=False, *args, **kwargs):
        self.is_sudo = is_sudo
        super(ApiClientHandler, self).__init__(*args, **kwargs)

    def get_response(self, request):
        # This is the simplest place we can hook into to patch the
        # request object.
        request._sudo = self.is_sudo
        return super(ApiClientHandler, self).get_response(request)


class RequestClient(DefaultRequestClient):
    def __init__(self, enforce_csrf_checks=False, is_sudo=False, **defaults):
        super(DefaultRequestClient, self).__init__(**defaults)
        self.handler = ApiClientHandler(
            enforce_csrf_checks=enforce_csrf_checks,
            is_sudo=is_sudo,
        )
        self._credentials = {}


class ApiClient(object):
    prefix = '/api/0'

    ApiError = ApiError

    def request(self, method, path, user, auth=None, params=None, data=None,
                is_sudo=False, content_type='application/json'):

        assert not (params and data)

        if method.lower() == 'get':
            data = params

        full_path = self.prefix + path

        # TODO(dcramer): implement is_sudo
        client = RequestClient(is_sudo=is_sudo)
        client.force_authenticate(user, auth)

        handler = getattr(client, method.lower())

        response = handler(
            full_path, data,
            content_type=content_type
        )

        if 200 <= response.status_code < 400:
            return response

        if response['Content-Type'] == 'application/json' and response.content:
            data = json.loads(response.content)
        else:
            data = ''

        raise self.ApiError(response.status_code, data)

    def get(self, *args, **kwargs):
        return self.request('GET', *args, **kwargs)

    def post(self, *args, **kwargs):
        return self.request('POST', *args, **kwargs)

    def put(self, *args, **kwargs):
        return self.request('PUT', *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self.request('DELETE', *args, **kwargs)

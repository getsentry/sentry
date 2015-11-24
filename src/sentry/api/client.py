from __future__ import absolute_import

__all__ = ('ApiClient',)

from django.core.urlresolvers import resolve
from rest_framework.test import APIRequestFactory, force_authenticate

from sentry.utils import json


class ApiError(Exception):
    def __init__(self, status_code, body):
        self.status_code = status_code
        self.body = body

    def __unicode__(self):
        return 'status=%s body=%s' % (self.status_code, self.body)


class ApiClient(object):
    prefix = '/api/0'

    ApiError = ApiError

    def request(self, method, path, user=None, auth=None, params=None, data=None,
                is_sudo=False, request=None):
        full_path = self.prefix + path

        assert not (request and (user or auth)), 'use either request or auth'

        resolver_match = resolve(full_path)
        callback, callback_args, callback_kwargs = resolver_match

        if data:
            # we encode to ensure compatibility
            data = json.loads(json.dumps(data))

        if request:
            user = request.user
            auth = request.auth

        rf = APIRequestFactory()
        mock_request = getattr(rf, method.lower())(full_path, data)
        mock_request.auth = auth
        mock_request.user = user
        mock_request.is_sudo = lambda: is_sudo

        if request:
            # superuser checks require access to IP
            mock_request.META['REMOTE_ADDR'] = request.META['REMOTE_ADDR']

        force_authenticate(mock_request, user, auth)

        if params:
            mock_request.GET._mutable = True
            mock_request.GET.update(params)
            mock_request.GET._mutable = False

        if data:
            mock_request.POST._mutable = True
            mock_request.POST.update(data)
            mock_request.POST._mutable = False

        response = callback(mock_request, *callback_args, **callback_kwargs)

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

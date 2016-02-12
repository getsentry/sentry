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
        return u'status={} body={}'.format(self.status_code, self.body)

    def __str__(self):
        return self.__unicode__().encode('utf-8')

    def __repr__(self):
        return u'<ApiError: {}>'.format(self.__unicode__())


class ApiClient(object):
    prefix = '/api/0'

    ApiError = ApiError

    def request(self, method, path, user=None, auth=None, params=None, data=None,
                is_sudo=None, is_superuser=None, request=None):
        full_path = self.prefix + path

        # we explicitly do not allow you to override the request *and* the user
        # as then other checks like is_superuser would need overwritten
        assert not (request and (user or auth)), 'use either request or auth'

        resolver_match = resolve(full_path)
        callback, callback_args, callback_kwargs = resolver_match

        if data:
            # we encode to ensure compatibility
            data = json.loads(json.dumps(data))

        rf = APIRequestFactory()
        mock_request = getattr(rf, method.lower())(full_path, data or {})

        if request:
            mock_request.auth = getattr(request, 'auth', None)
            mock_request.user = request.user

            if is_sudo is None:
                mock_request.is_sudo = lambda: request.is_sudo()
            else:
                mock_request.is_sudo = lambda: is_sudo

            if is_superuser is None:
                mock_request.is_superuser = lambda: request.is_superuser()
            else:
                mock_request.is_superuser = lambda: is_superuser
        else:
            mock_request.auth = auth
            mock_request.user = user
            mock_request.is_sudo = lambda: is_sudo
            mock_request.is_superuser = lambda: is_superuser

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

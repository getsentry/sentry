from __future__ import absolute_import

__all__ = ('ApiClient',)

from django.core.urlresolvers import resolve
from rest_framework.test import APIRequestFactory

from sentry.utils import json


class ApiClient(object):
    prefix = '/api/0'

    def request(self, method, path, user, auth=None, params=None, data=None):
        resolver_match = resolve(self.prefix + path)
        callback, callback_args, callback_kwargs = resolver_match

        if data:
            # we encode to ensure compatibility
            data = json.loads(json.dumps(data))

        rf = APIRequestFactory()
        mock_request = getattr(rf, method.lower())(path)
        mock_request.auth = auth
        mock_request.user = user

        if params:
            mock_request.GET._mutable = True
            mock_request.GET.update(params)
            mock_request.GET._mutable = False

        if data:
            mock_request.POST._mutable = True
            mock_request.POST.update(data)
            mock_request.POST._mutable = False

        return callback(mock_request, *callback_args, **callback_kwargs)

    def get(self, *args, **kwargs):
        return self.request('GET', *args, **kwargs)

    def post(self, *args, **kwargs):
        return self.request('POST', *args, **kwargs)

    def put(self, *args, **kwargs):
        return self.request('PUT', *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self.request('DELETE', *args, **kwargs)

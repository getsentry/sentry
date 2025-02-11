from __future__ import annotations

from typing import TypeAlias

import orjson
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.urls import resolve
from rest_framework.test import APIRequestFactory, force_authenticate

from sentry.auth.superuser import Superuser

__all__ = ("ApiClient",)


class ApiError(Exception):
    def __init__(self, status_code, body):
        self.status_code = status_code
        self.body = body

    def __str__(self):
        return f"status={self.status_code} body={self.body}"

    def __repr__(self):
        return f"<ApiError: {self}>"


class ApiClient:
    prefix = "/api/0"

    ApiError: TypeAlias = ApiError

    def request(
        self,
        method,
        path,
        user=None,
        auth=None,
        params=None,
        data=None,
        is_sudo=None,
        is_superuser=None,
        request=None,
    ):
        if self.prefix not in path:
            full_path = self.prefix + path
        else:
            full_path = path

        # we explicitly do not allow you to override the request *and* the user
        # as then other checks like is_superuser would need overwritten
        assert not (request and (user or auth)), "use either request or auth"

        resolver_match = resolve(full_path)
        callback, callback_args, callback_kwargs = resolver_match

        if data:
            # TODO(@anonrig): Investigate why we are doing this?
            # we encode to ensure compatibility
            data = orjson.loads(orjson.dumps(data, option=orjson.OPT_UTC_Z))

        rf = APIRequestFactory()
        mock_request = getattr(rf, method.lower())(full_path, data or {})
        # Flag to our API class that we should trust this auth passed through
        mock_request.__from_api_client__ = True

        if request:
            mock_request.auth = getattr(request, "auth", None)
            mock_request.user = request.user

            if is_sudo is None:
                mock_request.is_sudo = lambda: request.is_sudo()
            else:
                mock_request.is_sudo = lambda: is_sudo
            mock_request.session = request.session

            if is_superuser is None:
                mock_request.superuser = request.superuser
            else:
                mock_request.superuser = Superuser(mock_request)
        else:
            mock_request.auth = auth
            mock_request.user = user or AnonymousUser()
            mock_request.is_sudo = lambda: is_sudo
            mock_request.session = {}
            mock_request.superuser = Superuser(mock_request)

        if "*" not in settings.ALLOWED_HOSTS:
            mock_request.META["HTTP_HOST"] = settings.ALLOWED_HOSTS[0]
        mock_request.is_superuser = lambda: mock_request.superuser.is_active

        if request:
            # superuser checks require access to IP
            mock_request.META["REMOTE_ADDR"] = request.META["REMOTE_ADDR"]

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
        return self.request("GET", *args, **kwargs)

    def post(self, *args, **kwargs):
        return self.request("POST", *args, **kwargs)

    def put(self, *args, **kwargs):
        return self.request("PUT", *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self.request("DELETE", *args, **kwargs)

from __future__ import annotations

from urllib.parse import urlencode

import requests
from django.urls import reverse
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry.utils import json

from ..asserts import assert_status_code
from .base import BaseTestCase


class APITestCase(BaseTestCase, BaseAPITestCase):
    """
    Extend APITestCase to inherit access to `client`, an object with methods
    that simulate API calls to Sentry, and the helper `get_response`, which
    combines and simplify a lot of tedious parts of making API calls in tests.
    When creating API tests, use a new class per endpoint-method pair. The class
    must set the string `endpoint`.
    """

    endpoint = None
    method = "get"

    def get_response(self, *args, **params):
        """
        Simulate an API call to the test case's URI and method.

        :param params:
            Note: These names are intentionally a little funny to prevent name
             collisions with real API arguments.
            * extra_headers: (Optional) Dict mapping keys to values that will be
             passed as request headers.
            * qs_params: (Optional) Dict mapping keys to values that will be
             url-encoded into a API call's query string.
            * raw_data: (Optional) Sometimes we want to precompute the JSON body.
        :returns Response object
        """
        if self.endpoint is None:
            raise Exception("Implement self.endpoint to use this method.")

        url = reverse(self.endpoint, args=args)
        # In some cases we want to pass querystring params to put/post, handle
        # this here.
        if "qs_params" in params:
            query_string = urlencode(params.pop("qs_params"), doseq=True)
            url = f"{url}?{query_string}"

        headers = params.pop("extra_headers", {})
        raw_data = params.pop("raw_data", None)
        if raw_data and isinstance(raw_data, bytes):
            raw_data = raw_data.decode("utf-8")
        if raw_data and isinstance(raw_data, str):
            raw_data = json.loads(raw_data)
        data = raw_data or params
        method = params.pop("method", self.method).lower()

        return getattr(self.client, method)(url, format="json", data=data, **headers)

    def get_valid_response(self, *args, **params):
        """Deprecated. Calls `get_response` (see above) and asserts a specific status code."""
        status_code = params.pop("status_code", 200)
        resp = self.get_response(*args, **params)
        assert resp.status_code == status_code, (resp.status_code, resp.content)
        return resp

    def get_success_response(self, *args, **params):
        """
        Call `get_response` (see above) and assert the response's status code.

        :param params:
            * status_code: (Optional) Assert that the response's status code is
            a specific code. Omit to assert any successful status_code.
        :returns Response object
        """
        status_code = params.pop("status_code", None)

        if status_code and status_code >= 400:
            raise Exception("status_code must be < 400")

        response = self.get_response(*args, **params)

        if status_code:
            assert_status_code(response, status_code)
        else:
            assert_status_code(response, 200, 300)

        return response

    def get_error_response(self, *args, **params):
        """
        Call `get_response` (see above) and assert that the response's status
        code is an error code. Basically it's syntactic sugar.

        :param params:
            * status_code: (Optional) Assert that the response's status code is
            a specific error code. Omit to assert any error status_code.
        :returns Response object
        """
        status_code = params.pop("status_code", None)

        if status_code and status_code < 400:
            raise Exception("status_code must be >= 400 (an error status code)")

        response = self.get_response(*args, **params)

        if status_code:
            assert_status_code(response, status_code)
        else:
            assert_status_code(response, 400, 600)

        return response

    def get_cursor_headers(self, response):
        return [
            link["cursor"]
            for link in requests.utils.parse_header_links(
                response.get("link").rstrip(">").replace(">,<", ",<")
            )
        ]

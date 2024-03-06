from unittest import TestCase

import pytest
from django.http import HttpRequest
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.paginator import MissingPaginationError


class APIPaginationCheckTestCase(TestCase):
    def test_if_wrong_api_method_fails(self) -> None:
        class ExampleEndpoint(TestCase, Endpoint):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.access = "read"

            # Required to go through the dispatch method
            def initialize_request(self, request, *args, **kwargs) -> Request:
                return request

            # Required to go through the dispatch method
            def check_permissions(self, request: Request) -> None:
                pass

            def get(self, request, *args, **kwargs):
                return Response(data=[])

        # Test the endpoint, assert there is a MissingPaginationError
        with pytest.raises(MissingPaginationError):
            endpoint = ExampleEndpoint()
            request = Request(HttpRequest())
            request.method = "GET"
            request.access = "read"
            ExampleEndpoint.dispatch(endpoint, request)

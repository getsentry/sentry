from unittest import TestCase

import pytest
from django.test import RequestFactory
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.paginator import MissingPaginationError, OffsetPaginator


class APIPaginationCheckTestCase(TestCase):
    def test_if_wrong_api_method_fails(self) -> None:
        class ExampleEndpoint(TestCase, Endpoint):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.access = "read"

            # Required to go through the dispatch method
            def check_permissions(self, request: Request) -> None:
                pass

            def get(self, request, *args, **kwargs):
                return Response(data=[])

        # Test the endpoint, assert there is a MissingPaginationError
        with pytest.raises(MissingPaginationError):
            endpoint = ExampleEndpoint()
            request = RequestFactory().get("/")
            request.access = "read"
            ExampleEndpoint.dispatch(endpoint, request)

    def test_endpoint_in_allowlist(self) -> None:
        class GroupTagsEndpoint(TestCase, Endpoint):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.access = "read"

            # Required to go through the dispatch method
            def check_permissions(self, request: Request) -> None:
                pass

            def get(self, request, *args, **kwargs):
                return Response(data=[])

        # Test the endpoint, assert there is no MissingPaginationError
        endpoint = GroupTagsEndpoint()
        request = RequestFactory().get("/")
        request.access = "read"
        GroupTagsEndpoint.dispatch(endpoint, request)

    def test_empty_payload_with_pagination(self) -> None:
        class ExampleEndpoint(Endpoint):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.access = "read"

            # Required to go through the dispatch method
            def check_permissions(self, request: Request) -> None:
                pass

            # call the pagination method
            def get(self, request, *args, **kwargs):
                return self.paginate(
                    request=request,
                    queryset=[],
                    paginator_cls=OffsetPaginator,
                    on_results=lambda data: Response(data),
                )

        # Test the endpoint, assert there is no MissingPaginationError
        endpoint = ExampleEndpoint()
        request = RequestFactory().get("/")
        request.access = "read"
        ExampleEndpoint.dispatch(endpoint, request)

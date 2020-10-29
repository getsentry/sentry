from __future__ import absolute_import

import base64

from django.http import HttpRequest
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models import ApiKey
from sentry.testutils import APITestCase


class DummyEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        return Response({"ok": True})


class DummyPaginationEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        values = [x for x in range(0, 100)]

        def data_fn(offset, limit):
            page_offset = offset * limit
            return values[page_offset : page_offset + limit]

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn),
            on_results=lambda results: results,
        )


_dummy_endpoint = DummyEndpoint.as_view()


class EndpointTest(APITestCase):
    def test_basic_cors(self):
        org = self.create_organization()
        apikey = ApiKey.objects.create(organization=org, allowed_origins="*")

        request = HttpRequest()
        request.method = "GET"
        request.META["HTTP_ORIGIN"] = "http://example.com"
        request.META["HTTP_AUTHORIZATION"] = b"Basic " + base64.b64encode(
            apikey.key.encode("utf-8")
        )

        response = _dummy_endpoint(request)
        response.render()

        assert response.status_code == 200, response.content

        assert response["Access-Control-Allow-Origin"] == "http://example.com"


class PaginateTest(APITestCase):
    def setUp(self):
        super(PaginateTest, self).setUp()
        self.request = HttpRequest()
        self.request.method = "GET"
        self.view = DummyPaginationEndpoint().as_view()

    def test_success(self):
        response = self.view(self.request)
        assert response.status_code == 200, response.content

    def test_invalid_per_page(self):
        self.request.GET = {"per_page": "nope"}
        response = self.view(self.request)
        assert response.status_code == 400

    def test_invalid_cursor(self):
        self.request.GET = {"cursor": "no:no:no"}
        response = self.view(self.request)
        assert response.status_code == 400

    def test_per_page_out_of_bounds(self):
        self.request.GET = {"per_page": "101"}
        response = self.view(self.request)
        assert response.status_code == 400


class EndpointJSONBodyTest(APITestCase):
    def setUp(self):
        super(EndpointJSONBodyTest, self).setUp()

        self.request = HttpRequest()
        self.request.method = "GET"
        self.request.META["CONTENT_TYPE"] = "application/json"

    def test_json(self):
        self.request._body = '{"foo":"bar"}'

        Endpoint().load_json_body(self.request)

        assert self.request.json_body == {"foo": "bar"}

    def test_invalid_json(self):
        self.request._body = "hello"

        Endpoint().load_json_body(self.request)

        assert not self.request.json_body

    def test_empty_request_body(self):
        self.request._body = ""

        Endpoint().load_json_body(self.request)

        assert not self.request.json_body

    def test_non_json_content_type(self):
        self.request.META["CONTENT_TYPE"] = "text/plain"

        Endpoint().load_json_body(self.request)

        assert not self.request.json_body

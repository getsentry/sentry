import base64

from django.http import HttpRequest, StreamingHttpResponse
from django.test import override_settings
from pytest import raises
from rest_framework.response import Response

from sentry.api.base import Endpoint, EndpointSiloLimit, resolve_region
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models import ApiKey
from sentry.silo import SiloMode
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


class DummyPaginationStreamingEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        values = [x for x in range(0, 100)]

        def data_fn(offset, limit):
            page_offset = offset * limit
            return values[page_offset : page_offset + limit]

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn),
            on_results=lambda results: iter(results),
            response_cls=StreamingHttpResponse,
            response_kwargs={"content_type": "application/json"},
        )


_dummy_streaming_endpoint = DummyPaginationStreamingEndpoint.as_view()


class EndpointTest(APITestCase):
    def test_basic_cors(self):
        org = self.create_organization()
        apikey = ApiKey.objects.create(organization=org, allowed_origins="*")

        request = self.make_request(method="GET")
        request.META["HTTP_ORIGIN"] = "http://example.com"
        request.META["HTTP_AUTHORIZATION"] = b"Basic " + base64.b64encode(
            apikey.key.encode("utf-8")
        )

        response = _dummy_endpoint(request)
        response.render()

        assert response.status_code == 200, response.content

        assert response["Access-Control-Allow-Origin"] == "http://example.com"
        assert response["Access-Control-Allow-Headers"] == (
            "X-Sentry-Auth, X-Requested-With, Origin, Accept, "
            "Content-Type, Authentication, Authorization, Content-Encoding, "
            "sentry-trace, baggage"
        )
        assert response["Access-Control-Expose-Headers"] == "X-Sentry-Error, Retry-After"
        assert response["Access-Control-Allow-Methods"] == "GET, HEAD, OPTIONS"

    def test_invalid_cors_without_auth(self):
        request = self.make_request(method="GET")
        request.META["HTTP_ORIGIN"] = "http://example.com"

        with self.settings(SENTRY_ALLOW_ORIGIN="https://sentry.io"):
            response = _dummy_endpoint(request)
            response.render()

        assert response.status_code == 400, response.content

    def test_valid_cors_without_auth(self):
        request = self.make_request(method="GET")
        request.META["HTTP_ORIGIN"] = "http://example.com"

        with self.settings(SENTRY_ALLOW_ORIGIN="*"):
            response = _dummy_endpoint(request)
            response.render()

        assert response.status_code == 200, response.content
        assert response["Access-Control-Allow-Origin"] == "http://example.com"

    # XXX(dcramer): The default setting needs to allow requests to work or it will be a regression
    def test_cors_not_configured_is_valid(self):
        request = self.make_request(method="GET")
        request.META["HTTP_ORIGIN"] = "http://example.com"

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            response = _dummy_endpoint(request)
            response.render()

        assert response.status_code == 200, response.content
        assert response["Access-Control-Allow-Origin"] == "http://example.com"
        assert response["Access-Control-Allow-Headers"] == (
            "X-Sentry-Auth, X-Requested-With, Origin, Accept, "
            "Content-Type, Authentication, Authorization, Content-Encoding, "
            "sentry-trace, baggage"
        )
        assert response["Access-Control-Expose-Headers"] == "X-Sentry-Error, Retry-After"
        assert response["Access-Control-Allow-Methods"] == "GET, HEAD, OPTIONS"


class PaginateTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.request = self.make_request(method="GET")
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

    def test_custom_response_type(self):
        response = _dummy_streaming_endpoint(self.request)
        assert response.status_code == 200
        assert type(response) == StreamingHttpResponse
        assert response.has_header("content-type")


class EndpointJSONBodyTest(APITestCase):
    def setUp(self):
        super().setUp()

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


class CustomerDomainTest(APITestCase):
    def test_resolve_region(self):
        def request_with_subdomain(subdomain):
            request = self.make_request(method="GET")
            request.subdomain = subdomain
            return resolve_region(request)

        assert request_with_subdomain("us") == "us"
        assert request_with_subdomain("eu") == "eu"
        assert request_with_subdomain("sentry") is None


class SiloModeTest(APITestCase):
    def _test_active_on(self, endpoint_mode, active_mode, expect_to_be_active):
        @EndpointSiloLimit(endpoint_mode)
        class DecoratedEndpoint(DummyEndpoint):
            pass

        class EndpointWithDecoratedMethod(DummyEndpoint):
            @EndpointSiloLimit(endpoint_mode)
            def get(self, request):
                return super().get(request)

        with override_settings(SILO_MODE=active_mode):
            request = self.make_request(method="GET")

            for endpoint_class in (DecoratedEndpoint, EndpointWithDecoratedMethod):
                view = endpoint_class.as_view()
                with override_settings(FAIL_ON_UNAVAILABLE_API_CALL=False):
                    response = view(request)
                    assert response.status_code == (200 if expect_to_be_active else 404)

            if not expect_to_be_active:
                with override_settings(FAIL_ON_UNAVAILABLE_API_CALL=True):
                    with raises(EndpointSiloLimit.AvailabilityError):
                        DecoratedEndpoint.as_view()(request)
                    # TODO: Make work with EndpointWithDecoratedMethod

    def test_with_active_mode(self):
        self._test_active_on(SiloMode.REGION, SiloMode.REGION, True)
        self._test_active_on(SiloMode.CONTROL, SiloMode.CONTROL, True)

    def test_with_inactive_mode(self):
        self._test_active_on(SiloMode.REGION, SiloMode.CONTROL, False)
        self._test_active_on(SiloMode.CONTROL, SiloMode.REGION, False)

    def test_with_monolith_mode(self):
        self._test_active_on(SiloMode.REGION, SiloMode.MONOLITH, True)
        self._test_active_on(SiloMode.CONTROL, SiloMode.MONOLITH, True)

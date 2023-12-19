from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpRequest, QueryDict, StreamingHttpResponse
from django.test import override_settings
from pytest import raises
from rest_framework.response import Response
from sentry_sdk import Scope
from sentry_sdk.utils import exc_info_from_error

from sentry.api.base import Endpoint, EndpointSiloLimit
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models.apikey import ApiKey
from sentry.services.hybrid_cloud.util import FunctionSiloLimit
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_regions
from sentry.types.region import subdomain_is_region
from sentry.utils.cursors import Cursor


# Though it looks weird to have a method outside a class, this isn't a mistake but rather
# a mock for a method in Django REST Framework's `APIView` class
def reraise(self, e: Exception):
    raise e


class DummyEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        return Response({"ok": True})


class DummyErroringEndpoint(Endpoint):
    permission_classes = ()
    # `as_view` requires that any init args passed to it match attributes already on the
    # class, so even though they're really meant to be instance attributes, we have to
    # add them here as class attributes first
    error = NotImplementedError()
    handler_context_arg = None
    scope_arg = None

    def __init__(
        self,
        *args,
        error: Exception,
        handler_context_arg=None,
        scope_arg=None,
        **kwargs,
    ):
        # The error which will be thrown when a GET request is made
        self.error = error
        # The argumets which will be passed on to `Endpoint.handle_exception` via `super`
        self.handler_context_arg = handler_context_arg
        self.scope_arg = scope_arg

        super().__init__(*args, **kwargs)

    def get(self, request):
        raise self.error

    def handle_exception(self, request, exc, handler_context=None, scope=None):
        return super().handle_exception(request, exc, self.handler_context_arg, self.scope_arg)


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


@all_silo_test
class EndpointTest(APITestCase):
    def test_basic_cors(self):
        org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            apikey = ApiKey.objects.create(organization_id=org.id, allowed_origins="*")

        request = self.make_request(method="GET")
        request.META["HTTP_ORIGIN"] = "http://example.com"
        request.META["HTTP_AUTHORIZATION"] = self.create_basic_auth_header(apikey.key)

        response = _dummy_endpoint(request)
        response.render()

        assert response.status_code == 200, response.content

        assert response["Access-Control-Allow-Origin"] == "http://example.com"
        assert response["Access-Control-Allow-Headers"] == (
            "X-Sentry-Auth, X-Requested-With, Origin, Accept, "
            "Content-Type, Authentication, Authorization, Content-Encoding, "
            "sentry-trace, baggage, X-CSRFToken"
        )
        assert response["Access-Control-Expose-Headers"] == (
            "X-Sentry-Error, X-Sentry-Direct-Hit, X-Hits, X-Max-Hits, "
            "Endpoint, Retry-After, Link"
        )
        assert response["Access-Control-Allow-Methods"] == "GET, HEAD, OPTIONS"
        assert "Access-Control-Allow-Credentials" not in response

    @override_options({"system.base-hostname": "example.com"})
    def test_allow_credentials_subdomain(self):
        org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            apikey = ApiKey.objects.create(organization_id=org.id, allowed_origins="*")

        request = self.make_request(method="GET")
        # Origin is a subdomain of base-hostname, and is cors allowed
        request.META["HTTP_ORIGIN"] = "http://acme.example.com"
        request.META["HTTP_AUTHORIZATION"] = self.create_basic_auth_header(apikey.key)

        response = _dummy_endpoint(request)
        response.render()

        assert response.status_code == 200, response.content
        assert response["Access-Control-Allow-Origin"] == "http://acme.example.com"
        assert response["Access-Control-Allow-Headers"] == (
            "X-Sentry-Auth, X-Requested-With, Origin, Accept, "
            "Content-Type, Authentication, Authorization, Content-Encoding, "
            "sentry-trace, baggage, X-CSRFToken"
        )
        assert response["Access-Control-Expose-Headers"] == (
            "X-Sentry-Error, X-Sentry-Direct-Hit, X-Hits, X-Max-Hits, "
            "Endpoint, Retry-After, Link"
        )
        assert response["Access-Control-Allow-Methods"] == "GET, HEAD, OPTIONS"
        assert response["Access-Control-Allow-Credentials"] == "true"

    @override_options({"system.base-hostname": "example.com"})
    def test_allow_credentials_root_domain(self):
        org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            apikey = ApiKey.objects.create(organization_id=org.id, allowed_origins="*")

        request = self.make_request(method="GET")
        # Origin is base-hostname, and is cors allowed
        request.META["HTTP_ORIGIN"] = "http://example.com"
        request.META["HTTP_AUTHORIZATION"] = self.create_basic_auth_header(apikey.key)

        response = _dummy_endpoint(request)
        response.render()

        assert response.status_code == 200, response.content
        assert response["Access-Control-Allow-Origin"] == "http://example.com"
        assert response["Access-Control-Allow-Headers"] == (
            "X-Sentry-Auth, X-Requested-With, Origin, Accept, "
            "Content-Type, Authentication, Authorization, Content-Encoding, "
            "sentry-trace, baggage, X-CSRFToken"
        )
        assert response["Access-Control-Expose-Headers"] == (
            "X-Sentry-Error, X-Sentry-Direct-Hit, X-Hits, X-Max-Hits, "
            "Endpoint, Retry-After, Link"
        )
        assert response["Access-Control-Allow-Methods"] == "GET, HEAD, OPTIONS"
        assert response["Access-Control-Allow-Credentials"] == "true"

    @override_options({"system.base-hostname": "example.com"})
    @override_settings(ALLOWED_CREDENTIAL_ORIGINS=["http://docs.example.org"])
    def test_allow_credentials_allowed_domain(self):
        org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            apikey = ApiKey.objects.create(organization_id=org.id, allowed_origins="*")

        request = self.make_request(method="GET")
        # Origin is an allowed domain
        request.META["HTTP_ORIGIN"] = "http://docs.example.org"
        request.META["HTTP_AUTHORIZATION"] = self.create_basic_auth_header(apikey.key)

        response = _dummy_endpoint(request)
        response.render()

        assert response.status_code == 200, response.content
        assert response["Access-Control-Allow-Origin"] == "http://docs.example.org"
        assert response["Access-Control-Allow-Headers"] == (
            "X-Sentry-Auth, X-Requested-With, Origin, Accept, "
            "Content-Type, Authentication, Authorization, Content-Encoding, "
            "sentry-trace, baggage, X-CSRFToken"
        )
        assert response["Access-Control-Expose-Headers"] == (
            "X-Sentry-Error, X-Sentry-Direct-Hit, X-Hits, X-Max-Hits, "
            "Endpoint, Retry-After, Link"
        )
        assert response["Access-Control-Allow-Methods"] == "GET, HEAD, OPTIONS"
        assert response["Access-Control-Allow-Credentials"] == "true"

    @override_options({"system.base-hostname": "acme.com"})
    def test_allow_credentials_incorrect(self):
        org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            apikey = ApiKey.objects.create(organization_id=org.id, allowed_origins="*")

        for http_origin in ["http://acme.example.com", "http://fakeacme.com"]:
            request = self.make_request(method="GET")
            request.META["HTTP_ORIGIN"] = http_origin
            request.META["HTTP_AUTHORIZATION"] = self.create_basic_auth_header(apikey.key)

            response = _dummy_endpoint(request)
            response.render()
            assert "Access-Control-Allow-Credentials" not in response

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
            "sentry-trace, baggage, X-CSRFToken"
        )
        assert response["Access-Control-Expose-Headers"] == (
            "X-Sentry-Error, X-Sentry-Direct-Hit, X-Hits, X-Max-Hits, "
            "Endpoint, Retry-After, Link"
        )
        assert response["Access-Control-Allow-Methods"] == "GET, HEAD, OPTIONS"

    @mock.patch("sentry.api.base.Endpoint.convert_args")
    def test_method_not_allowed(self, mock_convert_args):
        request = self.make_request(method="POST")
        # Run this particular test in monolith mode to prevent RPC interactions
        with assume_test_silo_mode(SiloMode.MONOLITH):
            response = _dummy_endpoint(request)
            response.render()

        assert response.status_code == 405, response.content

        # did not try to convert args
        assert not mock_convert_args.info.called


class EndpointHandleExceptionTest(APITestCase):
    @mock.patch("rest_framework.views.APIView.handle_exception", return_value=Response(status=500))
    def test_handle_exception_when_super_returns_response(
        self, mock_super_handle_exception: MagicMock
    ):
        mock_endpoint = DummyErroringEndpoint.as_view(error=Exception("nope"))
        response = mock_endpoint(self.make_request(method="GET"))

        # The endpoint should pass along the response generated by `APIView.handle_exception`
        assert response == mock_super_handle_exception.return_value

    @mock.patch("rest_framework.views.APIView.handle_exception", new=reraise)
    @mock.patch("sentry.api.base.capture_exception", return_value="1231201211212012")
    def test_handle_exception_when_super_reraises(
        self,
        mock_capture_exception: MagicMock,
    ):
        handler_context = {"api_request_URL": "http://dogs.are.great/"}
        scope = Scope()
        tags = {"maisey": "silly", "charlie": "goofy"}
        for tag, value in tags.items():
            scope.set_tag(tag, value)

        cases = [
            # The first half of each tuple is what's passed to `handle_exception`, and the second
            # half is what we expect in the scope passed to `capture_exception`
            (None, None, {}, {}),
            (handler_context, None, {"Request Handler Data": handler_context}, {}),
            (None, scope, {}, tags),
            (
                handler_context,
                scope,
                {"Request Handler Data": handler_context},
                tags,
            ),
        ]

        for handler_context_arg, scope_arg, expected_scope_contexts, expected_scope_tags in cases:
            handler_error = Exception("nope")
            mock_endpoint = DummyErroringEndpoint.as_view(
                error=handler_error,
                handler_context_arg=handler_context_arg,
                scope_arg=scope_arg,
            )

            with mock.patch("sys.exc_info", return_value=exc_info_from_error(handler_error)):
                with mock.patch("sys.stderr.write") as mock_stderr_write:
                    response = mock_endpoint(self.make_request(method="GET"))

                    assert response.status_code == 500
                    assert response.data == {
                        "detail": "Internal Error",
                        "errorId": "1231201211212012",
                    }
                    assert response.exception is True

                    mock_stderr_write.assert_called_with("Exception: nope\n")

                    capture_exception_handler_context_arg = mock_capture_exception.call_args.args[0]
                    capture_exception_scope_kwarg = mock_capture_exception.call_args.kwargs.get(
                        "scope"
                    )

                    assert capture_exception_handler_context_arg == handler_error
                    assert isinstance(capture_exception_scope_kwarg, Scope)
                    assert capture_exception_scope_kwarg._contexts == expected_scope_contexts
                    assert capture_exception_scope_kwarg._tags == expected_scope_tags


class CursorGenerationTest(APITestCase):
    def test_serializes_params(self):
        request = self.make_request(method="GET", path="/api/0/organizations/")
        request.GET = QueryDict("member=1&cursor=foo")
        endpoint = Endpoint()
        result = endpoint.build_cursor_link(request, "next", "1492107369532:0:0")

        assert result == (
            "<http://testserver/api/0/organizations/?member=1&cursor=1492107369532:0:0>;"
            ' rel="next"; results="true"; cursor="1492107369532:0:0"'
        )

    def test_preserves_ssl_proto(self):
        request = self.make_request(method="GET", path="/api/0/organizations/", secure_scheme=True)
        request.GET = QueryDict("member=1&cursor=foo")
        endpoint = Endpoint()
        with override_options({"system.url-prefix": "https://testserver"}):
            result = endpoint.build_cursor_link(request, "next", "1492107369532:0:0")

        assert result == (
            "<https://testserver/api/0/organizations/?member=1&cursor=1492107369532:0:0>;"
            ' rel="next"; results="true"; cursor="1492107369532:0:0"'
        )

    def test_handles_customer_domains(self):
        request = self.make_request(
            method="GET", path="/api/0/organizations/", secure_scheme=True, subdomain="bebe"
        )
        request.GET = QueryDict("member=1&cursor=foo")
        endpoint = Endpoint()
        with override_options(
            {
                "system.url-prefix": "https://testserver",
                "system.organization-url-template": "https://{hostname}",
            }
        ):
            result = endpoint.build_cursor_link(request, "next", "1492107369532:0:0")

        assert result == (
            "<https://bebe.testserver/api/0/organizations/?member=1&cursor=1492107369532:0:0>;"
            ' rel="next"; results="true"; cursor="1492107369532:0:0"'
        )

    def test_unicode_path(self):
        request = self.make_request(method="GET", path="/api/0/organizations/üuuuu/")
        endpoint = Endpoint()
        result = endpoint.build_cursor_link(request, "next", "1492107369532:0:0")

        assert result == (
            "<http://testserver/api/0/organizations/%C3%BCuuuu/?&cursor=1492107369532:0:0>;"
            ' rel="next"; results="true"; cursor="1492107369532:0:0"'
        )

    def test_encodes_url(self):
        endpoint = Endpoint()
        request = self.make_request(method="GET", path="/foo/bar/lol:what/")

        result = endpoint.build_cursor_link(request, "next", cursor=Cursor(0, 0, 0))
        assert (
            result
            == '<http://testserver/foo/bar/lol%3Awhat/?&cursor=0:0:0>; rel="next"; results="false"; cursor="0:0:0"'
        )


class PaginateTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.request = self.make_request(method="GET")
        self.view = DummyPaginationEndpoint().as_view()

    def test_success(self):
        response = self.view(self.request)
        assert response.status_code == 200, response.content
        assert (
            response["Link"]
            == '<http://testserver/?&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://testserver/?&cursor=0:100:0>; rel="next"; results="false"; cursor="0:100:0"'
        )

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
        assert isinstance(response, StreamingHttpResponse)
        assert response.has_header("content-type")


class EndpointJSONBodyTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.request = HttpRequest()
        self.request.method = "GET"
        self.request.META["CONTENT_TYPE"] = "application/json"

    def test_json(self):
        self.request._body = b'{"foo":"bar"}'

        Endpoint().load_json_body(self.request)

        assert self.request.json_body == {"foo": "bar"}

    def test_invalid_json(self):
        self.request._body = b"hello"

        Endpoint().load_json_body(self.request)

        assert not self.request.json_body

    def test_empty_request_body(self):
        self.request._body = b""

        Endpoint().load_json_body(self.request)

        assert not self.request.json_body

    def test_non_json_content_type(self):
        self.request.META["CONTENT_TYPE"] = "text/plain"

        Endpoint().load_json_body(self.request)

        assert not self.request.json_body


@all_silo_test(regions=create_test_regions("us", "eu"))
class CustomerDomainTest(APITestCase):
    def test_resolve_region(self):
        def request_with_subdomain(subdomain):
            request = self.make_request(method="GET")
            request.subdomain = subdomain
            return subdomain_is_region(request)

        assert request_with_subdomain("us")
        assert request_with_subdomain("eu")
        assert not request_with_subdomain("sentry")


class EndpointSiloLimitTest(APITestCase):
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


class FunctionSiloLimitTest(APITestCase):
    def _test_active_on(self, endpoint_mode, active_mode, expect_to_be_active):
        @FunctionSiloLimit(endpoint_mode)
        def decorated_function():
            pass

        with override_settings(SILO_MODE=active_mode):
            if expect_to_be_active:
                decorated_function()
            else:
                with raises(FunctionSiloLimit.AvailabilityError):
                    decorated_function()

    def test_with_active_mode(self):
        self._test_active_on(SiloMode.REGION, SiloMode.REGION, True)
        self._test_active_on(SiloMode.CONTROL, SiloMode.CONTROL, True)

    def test_with_inactive_mode(self):
        self._test_active_on(SiloMode.REGION, SiloMode.CONTROL, False)
        self._test_active_on(SiloMode.CONTROL, SiloMode.REGION, False)

    def test_with_monolith_mode(self):
        self._test_active_on(SiloMode.REGION, SiloMode.MONOLITH, True)
        self._test_active_on(SiloMode.CONTROL, SiloMode.MONOLITH, True)

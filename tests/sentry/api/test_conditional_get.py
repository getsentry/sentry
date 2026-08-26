import re
from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.conditional_get import OPTION_NAME, ConditionalGetResponseMixin
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options


class DummyConditionalEndpoint(ConditionalGetResponseMixin, Endpoint):
    permission_classes: tuple[type[BasePermission], ...] = ()

    def get(self, request: Request) -> Response[dict[str, Any]]:
        return Response({"value": request.GET.get("value", "a")})

    def post(self, request: Request) -> Response[dict[str, Any]]:
        return Response({"value": "a"})


class DummyErrorEndpoint(DummyConditionalEndpoint):
    def get(self, request: Request) -> Response[dict[str, Any]]:
        return Response({"detail": "nope"}, status=400)


class DummyNonDictEndpoint(DummyConditionalEndpoint):
    def get(self, request: Request) -> Response[str]:  # type: ignore[override]
        return Response("plain")


class DummyHeaderEndpoint(DummyConditionalEndpoint):
    def get(self, request: Request) -> Response[dict[str, Any]]:
        response = super().get(request)
        response["X-Custom"] = "keep-me"
        return response


_conditional_endpoint = DummyConditionalEndpoint.as_view()
_error_endpoint = DummyErrorEndpoint.as_view()
_non_dict_endpoint = DummyNonDictEndpoint.as_view()
_header_endpoint = DummyHeaderEndpoint.as_view()


class ConditionalGetResponseMixinTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options({OPTION_NAME: True}))

    def test_get_sets_validator_headers(self) -> None:
        response = _conditional_endpoint(self.make_request(method="GET"))

        assert response.status_code == 200
        assert re.fullmatch(r'"[0-9a-f]{32}"', response["ETag"])
        assert response["Cache-Control"] == "private, no-cache"
        assert "Cookie" in response["Vary"]
        assert "Authorization" in response["Vary"]

    def test_equal_payloads_share_an_etag(self) -> None:
        first = _conditional_endpoint(self.make_request(method="GET"))
        second = _conditional_endpoint(self.make_request(method="GET"))

        assert first["ETag"] == second["ETag"]

    def test_changed_payload_changes_the_etag(self) -> None:
        first = _conditional_endpoint(self.make_request(method="GET"))
        second = _conditional_endpoint(self.make_request(method="GET", GET={"value": "b"}))

        assert first["ETag"] != second["ETag"]

    def test_matched_validator_returns_304_without_a_body(self) -> None:
        first = _conditional_endpoint(self.make_request(method="GET"))

        request = self.make_request(method="GET")
        request.META["HTTP_IF_NONE_MATCH"] = first["ETag"]
        response = _conditional_endpoint(request)
        response.render()

        assert response.status_code == 304
        assert response.content == b""
        assert response["ETag"] == first["ETag"]
        assert response["Cache-Control"] == "private, no-cache"

    def test_stale_validator_returns_the_full_body(self) -> None:
        current = _conditional_endpoint(self.make_request(method="GET"))["ETag"]

        request = self.make_request(method="GET")
        request.META["HTTP_IF_NONE_MATCH"] = '"stale"'
        response = _conditional_endpoint(request)
        response.render()

        assert response.status_code == 200
        assert response["ETag"] == current
        assert response.content == b'{"value":"a"}'

    def test_weak_validator_matches(self) -> None:
        first = _conditional_endpoint(self.make_request(method="GET"))

        request = self.make_request(method="GET")
        request.META["HTTP_IF_NONE_MATCH"] = f"W/{first['ETag']}"
        response = _conditional_endpoint(request)

        assert response.status_code == 304

    def test_validator_list_matches(self) -> None:
        first = _conditional_endpoint(self.make_request(method="GET"))

        request = self.make_request(method="GET")
        request.META["HTTP_IF_NONE_MATCH"] = f'"other", {first["ETag"]}'
        response = _conditional_endpoint(request)

        assert response.status_code == 304

    def test_wildcard_validator_matches(self) -> None:
        request = self.make_request(method="GET")
        request.META["HTTP_IF_NONE_MATCH"] = "*"
        response = _conditional_endpoint(request)

        assert response.status_code == 304

    def test_304_keeps_headers_set_by_the_endpoint(self) -> None:
        first = _header_endpoint(self.make_request(method="GET"))

        request = self.make_request(method="GET")
        request.META["HTTP_IF_NONE_MATCH"] = first["ETag"]
        response = _header_endpoint(request)

        assert response.status_code == 304
        assert response["X-Custom"] == "keep-me"

    def test_304_drops_the_content_type(self) -> None:
        first = _conditional_endpoint(self.make_request(method="GET"))

        request = self.make_request(method="GET")
        request.META["HTTP_IF_NONE_MATCH"] = first["ETag"]
        response = _conditional_endpoint(request)

        assert "Content-Type" not in response

    def test_post_is_untouched(self) -> None:
        response = _conditional_endpoint(self.make_request(method="POST"))

        assert response.status_code == 200
        assert "ETag" not in response

    def test_error_response_is_untouched(self) -> None:
        response = _error_endpoint(self.make_request(method="GET"))

        assert response.status_code == 400
        assert "ETag" not in response

    def test_non_dict_payload_gets_a_validator(self) -> None:
        first = _non_dict_endpoint(self.make_request(method="GET"))

        request = self.make_request(method="GET")
        request.META["HTTP_IF_NONE_MATCH"] = first["ETag"]
        response = _non_dict_endpoint(request)

        assert response.status_code == 304

    @override_options({OPTION_NAME: False})
    def test_disabled_option_is_untouched(self) -> None:
        response = _conditional_endpoint(self.make_request(method="GET"))

        assert response.status_code == 200
        assert "ETag" not in response

from django.http import HttpResponse
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.negotiation import PassthroughContentNegotiation
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test
from sentry.utils import json

GIT_RESULT_MEDIA_TYPE = "application/x-git-upload-pack-result"


class RelayingEndpoint(Endpoint):
    permission_classes: tuple[type[BasePermission], ...] = ()

    def get(self, request: Request) -> HttpResponse:
        return HttpResponse(b"0008NAK\n", content_type=GIT_RESULT_MEDIA_TYPE)


class PassthroughRelayingEndpoint(RelayingEndpoint):
    content_negotiation_class = PassthroughContentNegotiation


class PassthroughErroringEndpoint(Endpoint):
    permission_classes: tuple[type[BasePermission], ...] = ()
    content_negotiation_class = PassthroughContentNegotiation

    def get(self, request: Request) -> Response:
        return Response({"detail": "Upstream refused the request"}, status=502)


@all_silo_test
class PassthroughContentNegotiationTest(TestCase):
    def test_default_negotiation_refuses_non_json_accept(self) -> None:
        request = self.make_request()
        request.META["HTTP_ACCEPT"] = GIT_RESULT_MEDIA_TYPE

        response = RelayingEndpoint.as_view()(request)

        assert response.status_code == 406

    def test_non_json_accept_reaches_handler(self) -> None:
        request = self.make_request()
        request.META["HTTP_ACCEPT"] = GIT_RESULT_MEDIA_TYPE

        response = PassthroughRelayingEndpoint.as_view()(request)

        assert response.status_code == 200
        assert response["Content-Type"] == GIT_RESULT_MEDIA_TYPE
        assert response.content == b"0008NAK\n"

    def test_format_query_parameter_reaches_handler(self) -> None:
        request = self.make_request(GET={"format": "xml"})

        response = PassthroughRelayingEndpoint.as_view()(request)

        assert response.status_code == 200

    def test_endpoint_response_renders_as_json(self) -> None:
        request = self.make_request()
        request.META["HTTP_ACCEPT"] = GIT_RESULT_MEDIA_TYPE

        response = PassthroughErroringEndpoint.as_view()(request)
        response.render()

        assert response.status_code == 502
        assert response["Content-Type"] == "application/json"
        assert json.loads(response.content) == {"detail": "Upstream refused the request"}

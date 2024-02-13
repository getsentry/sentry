import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse

from sentry.middleware.integrations.parsers.vercel import VercelRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import assert_no_webhook_outboxes, assert_no_webhook_payloads
from sentry.testutils.silo import control_silo_test


@control_silo_test
class VercelRequestParserTest(TestCase):
    factory = RequestFactory()
    vercel_dummy_requests = [
        factory.get(reverse("sentry-extensions-vercel-configure")),
        factory.post(reverse("sentry-extensions-vercel-delete"), data={}),
        factory.post(reverse("sentry-extensions-vercel-webhook"), data={}),
    ]

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    @responses.activate
    def test_routing_all_to_control(self):
        for request in self.vercel_dummy_requests:
            parser = VercelRequestParser(request=request, response_handler=self.get_response)
            assert parser.get_integration_from_request() is None
            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_outboxes()

    @responses.activate
    @override_options({"hybridcloud.webhookpayload.rollout": 1.0})
    def test_routing_all_to_control_webhookpayload(self):
        for request in self.vercel_dummy_requests:
            parser = VercelRequestParser(request=request, response_handler=self.get_response)
            assert parser.get_integration_from_request() is None
            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_payloads()

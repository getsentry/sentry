from unittest.mock import MagicMock, patch

from django.http import HttpResponse
from django.test import RequestFactory
from django.urls import reverse

from sentry.middleware.integrations.parsers.vercel import VercelRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class VercelRequestParserTest(TestCase):
    get_response = MagicMock()
    factory = RequestFactory()
    vercel_dummy_requests = [
        factory.get(reverse("sentry-extensions-vercel-configure")),
        factory.post(reverse("sentry-extensions-vercel-delete"), data={}),
        factory.post(reverse("sentry-extensions-vercel-webhook"), data={}),
    ]

    def test_routing_all_to_control(self):
        for request in self.vercel_dummy_requests:
            parser = VercelRequestParser(request=request, response_handler=self.get_response)

            expected_response = HttpResponse({"ok": True})
            with patch.object(
                parser, "get_response_from_outbox_creation"
            ) as mock_response_from_outbox, patch.object(
                parser, "get_responses_from_region_silos"
            ) as mock_response_from_region, patch.object(
                parser, "get_response_from_control_silo", return_value=expected_response
            ) as mock_response_from_control:
                actual_response = parser.get_response()
                assert not mock_response_from_outbox.called
                assert not mock_response_from_region.called
                assert mock_response_from_control.called
                assert actual_response == expected_response

import logging

from django.http import HttpResponseBadRequest, HttpResponseBase, StreamingHttpResponse
from requests import Request, Response
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.renderers import JSONRenderer

from sentry.integrations.api.endpoints.integration_proxy import InternalIntegrationProxyEndpoint
from sentry.silo.util import (
    clean_outbound_headers,
)

logger = logging.getLogger(__name__)


class _PassthroughContentNegotiation(BaseContentNegotiation):
    """
    DRF's initial() method calls perform_content_negotiation() before the handler runs. The default
    negotiation class (DefaultContentNegotiation) tries to match the request's Accept header against
    configured renderers. Sentry only configures JSONRenderer, so any request with Accept: text/html,
    application/xml, etc. gets rejected with 406 Not Acceptable — even though this endpoint never
    uses DRF's rendering at all (it returns a raw StreamingHttpResponse).

    _PassthroughContentNegotiation bypasses that check by always returning a valid renderer,
    regardless of what the client sent in Accept. The returned renderer is never actually used.
    StreamingHttpResponse skips DRF's finalize_response rendering entirely — but DRF requires
    select_renderer to succeed for the request to proceed past initial().
    """

    def select_renderer(self, request, renderers, format_suffix=None):
        return (JSONRenderer(), JSONRenderer.media_type)


class InternalIntegrationProxy2Endpoint(InternalIntegrationProxyEndpoint):
    content_negotiation_class = _PassthroughContentNegotiation

    def _call_third_party_api(self, request, full_url: str, headers) -> HttpResponseBase:
        if not self._should_operate(request):
            return HttpResponseBadRequest()

        prepared_request = Request(
            method=request.method, url=full_url, headers=headers, data=request.body
        ).prepare()

        resp: Response = self.client.request(
            request.method,
            self.proxy_path,
            allow_text=True,
            prepared_request=prepared_request,
            raw_response=True,
            stream=True,
        )

        return StreamingHttpResponse(
            resp.iter_content(16 * 1024),
            status=resp.status_code,
            headers=clean_outbound_headers(resp.headers),
            reason=resp.reason,
        )

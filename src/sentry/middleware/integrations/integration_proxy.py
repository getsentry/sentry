import logging

from requests import Request

from sentry.silo.base import SiloMode

PROXY_ADDRESS = "/api/0/internal/proxy/"
PROXY_HOST_HEADER = "X-SENTRY-PROXY-HOST"
PROXY_OI_HEADER = "X-SENTRY-ORG-INTEGRATION"


logger = logging.getLogger(__name__)


class IntegrationProxyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def _should_operate(self, request) -> bool:
        """
        Determines whether this middleware will operate or just pass the request along.
        """
        is_correct_silo = SiloMode.get_current_mode() == SiloMode.CONTROL
        is_proxy = request.path.startswith(PROXY_ADDRESS)
        return is_correct_silo and is_proxy

    def __call__(self, request: Request):
        from sentry.integrations.slack.client import SlackClient
        from sentry.silo.client import BaseSiloClient

        if not self._should_operate(request):
            return self.get_response(request)

        desitination_path = request.path[len(PROXY_ADDRESS) :]
        desitination_host = request.headers.get(f"{PROXY_HOST_HEADER}")
        if desitination_host is None:
            return self.get_response(request)
        organization_integration_id = request.headers.get(f"{PROXY_OI_HEADER}")
        if organization_integration_id is None:
            return self.get_response(request)

        headers = BaseSiloClient.clean_headers(request.headers)
        prepared_request = Request(
            method=request.method,
            url=f"{desitination_host}/{desitination_path}",
            headers=headers,
            data=request.body,
        )

        client = SlackClient(org_integration_id=organization_integration_id)
        prepared_request = client.authorize_request(prepared_request).prepare()

        return client._request(
            request.method,
            desitination_path,
            allow_text=True,
            prepared_request=prepared_request,
            raw_response=True,
        )

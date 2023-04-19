import logging

from django.http import HttpResponse
from requests import Request, Response

from sentry.constants import ObjectStatus
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.silo.base import SiloMode
from sentry.silo.util import clean_proxy_headers

logger = logging.getLogger(__name__)
PROXY_ADDRESS = "/api/0/internal/proxy/"
PROXY_OI_HEADER = "X-Sentry-Organization-Integration"


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
        from sentry.silo.proxy.client import IntegrationProxyClient

        # TODO(Leander): Add shared secret validation in headers

        if not self._should_operate(request):
            return self.get_response(request)

        destination_path = request.path[len(PROXY_ADDRESS) :]

        headers = clean_proxy_headers(request.headers)
        log_extra = {"path": destination_path}

        org_integration_id = headers.pop(f"{PROXY_OI_HEADER}", None)
        if org_integration_id is None:
            logger.info("missing_org_integration", extra=log_extra)
            return self.get_response(request)
        log_extra["org_integration_id"] = org_integration_id

        org_integration = OrganizationIntegration.objects.filter(
            id=org_integration_id,
            status=ObjectStatus.ACTIVE,
        ).first()
        if org_integration is None:
            logger.info("invalid_org_integration", extra=log_extra)
            return self.get_response(request)
        log_extra["integration_id"] = org_integration.integration_id

        integration = Integration.objects.filter(
            status=ObjectStatus.ACTIVE,
            id=org_integration.integration_id,
        ).first()
        if integration is None:
            logger.info("invalid_integration", extra=log_extra)
            return self.get_response(request)

        installation = integration.get_installation(organization_id=org_integration.organization_id)
        client: IntegrationProxyClient = installation.get_client()
        client_type = type(client)
        log_extra["client_type"] = client_type

        if not issubclass(client_type, IntegrationProxyClient):
            logger.info("invalid_client", extra=log_extra)
            return self.get_response(request)

        destination_host = client.base_url
        # Might need to coerce slashes here

        proxy_request = Request(
            method=request.method,
            url=f"{destination_host}/{destination_path}",
            headers=headers,
            data=request.body,
        )
        prepared_request = client.authorize_request(proxy_request).prepare()
        raw_response: Response = client._request(
            request.method,
            destination_path,
            allow_text=True,
            prepared_request=prepared_request,
            raw_response=True,
        )
        response = HttpResponse(
            content=raw_response.content,
            status=raw_response.status_code,
            reason=raw_response.reason,
            content_type=raw_response.headers.get("Coƒntent-Type"),
        )
        response.headers = raw_response.headers
        return response

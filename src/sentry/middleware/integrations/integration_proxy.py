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

    @property
    def full_url(self) -> str:
        return f"{self.client.base_url}/{self.proxy_path}"

    def _validate_request(self, request) -> bool:
        """
        Returns True if a client could be generated from the request
        """
        from sentry.silo.proxy.client import IntegrationProxyClient

        self.proxy_path = request.path[len(PROXY_ADDRESS) :]
        self.headers = clean_proxy_headers(request.headers)

        log_extra = {"path": self.proxy_path}

        # Get the organization integration
        org_integration_id = self.headers.pop(f"{PROXY_OI_HEADER}", None)
        if org_integration_id is None:
            logger.info("missing_org_integration", extra=log_extra)
            return False
        log_extra["org_integration_id"] = org_integration_id

        self.org_integration = OrganizationIntegration.objects.filter(
            id=org_integration_id,
            status=ObjectStatus.ACTIVE,
        ).first()
        if self.org_integration is None:
            logger.info("invalid_org_integration", extra=log_extra)
            return False
        log_extra["integration_id"] = self.org_integration.integration_id

        # Get the integration
        self.integration = Integration.objects.filter(
            status=ObjectStatus.ACTIVE,
            id=self.org_integration.integration_id,
        ).first()
        if self.integration is None:
            logger.info("invalid_integration", extra=log_extra)
            return False

        # Get the integration client
        installation = self.integration.get_installation(
            organization_id=self.org_integration.organization_id
        )
        self.client: IntegrationProxyClient = installation.get_client()
        client_type = type(self.client)
        log_extra["client_type"] = client_type
        if not issubclass(client_type, IntegrationProxyClient):
            logger.info("invalid_client", extra=log_extra)
            return False

        return True

    def _should_operate(self, request) -> bool:
        """
        Determines whether this middleware will operate or just pass the request along.
        """
        is_correct_silo = SiloMode.get_current_mode() == SiloMode.CONTROL
        is_proxy = request.path.startswith(PROXY_ADDRESS)
        is_valid = self._validate_request(request)
        return is_correct_silo and is_proxy and is_valid

    def __call__(self, request: Request):
        if not self._should_operate(request):
            return self.get_response(request)

        # Add authorization, send the request and coerce the response for Django
        proxy_request = Request(
            method=request.method,
            url=self.full_url,
            headers=self.headers,
            data=request.body,
        )
        prepared_request = self.client.authorize_request(proxy_request).prepare()
        raw_response: Response = self.client._request(
            request.method,
            self.proxy_path,
            allow_text=True,
            prepared_request=prepared_request,
            raw_response=True,
        )
        response = HttpResponse(
            content=raw_response.content,
            status=raw_response.status_code,
            reason=raw_response.reason,
            content_type=raw_response.headers.get("Content-Type"),
            # headers=raw_response.headers # Can be added in Django 3.2
        )
        response.headers = raw_response.headers
        return response

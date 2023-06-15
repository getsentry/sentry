from __future__ import annotations

import logging
from typing import Dict

from django.http import Http404, HttpResponse
from requests import Request, Response
from rest_framework.request import Request as DrfRequest

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_BASE_PATH,
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    clean_outbound_headers,
    trim_leading_slashes,
    verify_subnet_signature,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@control_silo_endpoint
class InternalIntegrationProxyEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()
    log_extra: Dict[str, str | int] = {}
    """
    This endpoint is used to proxy requests from region silos to the third-party
    integration on behalf of credentials stored in the control silo.
    """

    @property
    def client(self):
        """
        We need to use a property decorator and setter here to overwrite it for tests.
        """
        return self._client

    @client.setter
    def client(self, client):
        self._client = client

    def _validate_sender(self, request: DrfRequest) -> bool:
        """
        Returns True if the sender is deemed sufficiently trustworthy.
        """
        signature = request.headers.get(PROXY_SIGNATURE_HEADER)
        identifier = request.headers.get(PROXY_OI_HEADER)
        if signature is None or identifier is None:
            logger.error("invalid_sender_headers", extra=self.log_extra)
            return False
        is_valid = verify_subnet_signature(
            request_body=request.body,
            path=self.proxy_path,
            identifier=identifier,
            provided_signature=signature,
        )
        if not is_valid:
            logger.error("invalid_sender_signature", extra=self.log_extra)

        return is_valid

    def _validate_request(self, request: DrfRequest) -> bool:
        """
        Returns True if a client could be generated from the request
        """
        from sentry.shared_integrations.client.proxy import IntegrationProxyClient

        # Get the organization integration
        org_integration_id = request.headers.get(PROXY_OI_HEADER)
        if org_integration_id is None:
            logger.error("missing_org_integration", extra=self.log_extra)
            return False
        self.log_extra["org_integration_id"] = org_integration_id

        self.org_integration = (
            OrganizationIntegration.objects.filter(
                id=org_integration_id,
                status=ObjectStatus.ACTIVE,
            )
            .select_related("integration")
            .first()
        )
        if self.org_integration is None:
            logger.error("invalid_org_integration", extra=self.log_extra)
            return False
        self.log_extra["integration_id"] = self.org_integration.integration_id

        # Get the integration
        self.integration = self.org_integration.integration
        if not self.integration or self.integration.status is not ObjectStatus.ACTIVE:
            logger.error("invalid_integration", extra=self.log_extra)
            return False

        # Get the integration client
        installation = self.integration.get_installation(
            organization_id=self.org_integration.organization_id
        )
        self.client: IntegrationProxyClient = installation.get_client()
        client_type = type(self.client)
        self.log_extra["client_type"] = client_type.__name__
        if not issubclass(client_type, IntegrationProxyClient):
            logger.error("invalid_client", extra=self.log_extra)
            return False

        return True

    def _should_operate(self, request: DrfRequest) -> bool:
        """
        Returns True if this endpoint should proxy the incoming integration request.
        """
        is_correct_silo = SiloMode.get_current_mode() == SiloMode.CONTROL
        if not is_correct_silo:
            return False

        is_valid_sender = self._validate_sender(request=request)
        if not is_valid_sender:
            metrics.incr("hc.integration_proxy.failure.invalid_sender")
            return False

        is_valid_request = self._validate_request(request=request)
        if not is_valid_request:
            metrics.incr("hc.integration_proxy.failure.invalid_request")
            return False

        return True

    def http_method_not_allowed(self, request):
        """
        Catch-all workaround instead of explicitly setting handlers for each method (GET, POST, etc.)
        """
        self.proxy_path = trim_leading_slashes(request.get_full_path()[len(PROXY_BASE_PATH) :])
        self.log_extra["method"] = request.method
        self.log_extra["path"] = self.proxy_path
        self.log_extra["host"] = request.headers.get("Host")

        if not self._should_operate(request):
            raise Http404

        full_url = f"{self.client.base_url}/{self.proxy_path}"
        self.log_extra["full_url"] = full_url
        headers = clean_outbound_headers(request.headers)

        prepared_request = Request(
            method=request.method,
            url=full_url,
            headers=headers,
            data=request.body,
        ).prepare()
        # Third-party authentication headers will be added in client.authorize_request which runs
        # in IntegrationProxyClient.finalize_request.
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
            # XXX: Can be added in Django 3.2
            # headers=raw_response.headers
        )
        valid_headers = clean_outbound_headers(raw_response.headers)
        for header, value in valid_headers.items():
            response[header] = value
        metrics.incr("hc.integration_proxy.success")
        logger.info("proxy_success", extra=self.log_extra)
        return response

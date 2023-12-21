from __future__ import annotations

import logging
from typing import Dict
from urllib.parse import urljoin

from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest
from requests import Request, Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_BASE_URL_HEADER,
    PROXY_KEYID_HEADER,
    PROXY_OI_HEADER,
    PROXY_PATH,
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

    def _validate_sender(self, request: HttpRequest) -> bool:
        """
        Returns True if the sender is deemed sufficiently trustworthy.
        """
        signature = request.headers.get(PROXY_SIGNATURE_HEADER)
        identifier = request.headers.get(PROXY_OI_HEADER)
        base_url = request.headers.get(PROXY_BASE_URL_HEADER)
        if signature is None or identifier is None or base_url is None:
            logger.info("integration_proxy.invalid_sender_headers", extra=self.log_extra)
            return False
        is_valid = verify_subnet_signature(
            base_url=base_url,
            path=self.proxy_path,
            identifier=identifier,
            request_body=request.body,
            provided_signature=signature,
        )
        if not is_valid:
            logger.info("integration_proxy.invalid_sender_signature", extra=self.log_extra)

        return is_valid

    def _validate_request(self, request: HttpRequest) -> bool:
        """
        Returns True if a client could be generated from the request
        """
        from sentry.shared_integrations.client.proxy import IntegrationProxyClient

        # Get the organization integration
        org_integration_id = request.headers.get(PROXY_OI_HEADER)
        if org_integration_id is None:
            logger.info("integration_proxy.missing_org_integration", extra=self.log_extra)
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
            logger.info("integration_proxy.invalid_org_integration", extra=self.log_extra)
            return False
        self.log_extra["integration_id"] = self.org_integration.integration_id

        # Get the integration
        self.integration = self.org_integration.integration
        if not self.integration or self.integration.status is not ObjectStatus.ACTIVE:
            logger.info("integration_proxy.invalid_integration", extra=self.log_extra)
            return False

        # Get the integration client
        installation = self.integration.get_installation(
            organization_id=self.org_integration.organization_id
        )

        # Get the client, some integrations use a keyring approach so
        # we need to pass in the keyid
        keyid = request.headers.get(PROXY_KEYID_HEADER)
        if keyid:
            self.client: IntegrationProxyClient = installation.get_keyring_client(keyid)
        else:
            self.client: IntegrationProxyClient = installation.get_client()
        client_class = self.client.__class__

        self.log_extra["client_type"] = client_class.__name__
        if not issubclass(client_class, IntegrationProxyClient):
            logger.info("integration_proxy.invalid_client", extra=self.log_extra)
            return False

        return True

    def _should_operate(self, request: HttpRequest) -> bool:
        """
        Returns True if this endpoint should proxy the incoming integration request.
        """
        is_correct_silo = SiloMode.get_current_mode() == SiloMode.CONTROL
        if not is_correct_silo:
            return False

        is_valid_sender = self._validate_sender(request=request)
        if not is_valid_sender:
            metrics.incr("hybrid_cloud.integration_proxy.failure.invalid_sender", sample_rate=1.0)
            return False

        is_valid_request = self._validate_request(request=request)
        if not is_valid_request:
            metrics.incr("hybrid_cloud.integration_proxy.failure.invalid_request", sample_rate=1.0)
            return False

        return True

    def _call_third_party_api(self, request, full_url: str, headers) -> HttpResponse:
        prepared_request = Request(
            method=request.method,
            url=full_url,
            headers=headers,
            data=request.body,
        ).prepare()
        # Third-party authentication headers will be added in client.authorize_request which runs
        # in IntegrationProxyClient.finalize_request.
        raw_response: Response = self.client.request(
            request.method,
            self.proxy_path,
            allow_text=True,
            prepared_request=prepared_request,
            raw_response=True,
        )
        clean_headers = clean_outbound_headers(raw_response.headers)
        return HttpResponse(
            content=raw_response.content,
            status=raw_response.status_code,
            reason=raw_response.reason,
            headers=clean_headers,
        )

    def http_method_not_allowed(self, request):
        """
        Catch-all workaround instead of explicitly setting handlers for each method (GET, POST, etc.)
        """
        # Removes leading slashes as it can result in incorrect urls being generated
        self.proxy_path = trim_leading_slashes(request.headers.get(PROXY_PATH, ""))
        self.log_extra["method"] = request.method
        self.log_extra["path"] = self.proxy_path
        self.log_extra["host"] = request.headers.get("Host")

        if not self._should_operate(request):
            return HttpResponseBadRequest()

        metrics.incr("hybrid_cloud.integration_proxy.initialize", sample_rate=1.0)

        base_url = request.headers.get(PROXY_BASE_URL_HEADER)
        base_url = base_url.rstrip("/")

        full_url = urljoin(f"{base_url}/", self.proxy_path)
        self.log_extra["full_url"] = full_url
        headers = clean_outbound_headers(request.headers)

        response = self._call_third_party_api(request=request, full_url=full_url, headers=headers)

        metrics.incr(
            "hybrid_cloud.integration_proxy.complete.response_code",
            tags={"status": response.status_code},
            sample_rate=1.0,
        )
        logger.info("proxy_success", extra=self.log_extra)
        return response

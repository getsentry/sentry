from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Generator, Mapping
from enum import StrEnum
from typing import Any, MutableMapping
from urllib.parse import urljoin

from django.conf import settings
from django.http import HttpRequest, HttpResponseBadRequest, StreamingHttpResponse
from requests import Request, Response
from requests.exceptions import RequestException
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request as DRFRequest
from rest_framework.response import Response as DRFResponse
from sentry_sdk import Scope

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_control_silo_endpoint
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.utils.metrics import IntegrationProxyEvent, IntegrationProxyEventType
from sentry.metrics.base import Tags
from sentry.shared_integrations.exceptions import (
    ApiForbiddenError,
    ApiHostError,
    ApiRateLimitedError,
    ApiTimeoutError,
    ApiUnauthorized,
)
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_BASE_URL_HEADER,
    PROXY_KEYID_HEADER,
    PROXY_OI_HEADER,
    PROXY_PATH,
    PROXY_SIGNATURE_HEADER,
    PROXY_TIMEOUT_HEADER,
    clean_outbound_headers,
    decode_proxy_timeout,
    trim_leading_slashes,
    verify_subnet_signature,
)
from sentry.utils import metrics
from sentry.utils.tracing import trace

logger = logging.getLogger(__name__)

METRIC_PREFIX = "hybrid_cloud.integration_proxy"


class IntegrationProxySuccessMetricType(StrEnum):
    INITIALIZE = "initialize"
    COMPLETE_RESPONSE_CODE = "complete.response_code"


class IntegrationProxyFailureMetricType(StrEnum):
    INVALID_SENDER_HEADERS = "invalid_sender_headers"
    INVALID_SENDER_SIGNATURE = "invalid_sender_signature"
    INVALID_ORG_INTEGRATION = "invalid_org_integration"
    INVALID_INTEGRATION = "invalid_integration"
    INVALID_CLIENT = "invalid_client"
    INVALID_MODE = "invalid_mode"
    INVALID_SENDER = "invalid_sender"
    INVALID_REQUEST = "invalid_request"
    INVALID_IDENTITY = "invalid_identity"
    HOST_UNREACHABLE_ERROR = "host_unreachable_error"
    HOST_TIMEOUT_ERROR = "host_timeout_error"
    UNAUTHORIZED_ERROR = "unauthorized_error"
    RATE_LIMITED_ERROR = "rate_limited_error"
    FORBIDDEN_ERROR = "forbidden_error"
    UNKNOWN_ERROR = "unknown_error"
    FAILED_VALIDATION = "failed_validation"


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


@internal_control_silo_endpoint
class InternalIntegrationProxyEndpoint(Endpoint):
    content_negotiation_class = _PassthroughContentNegotiation
    publish_status = defaultdict(lambda: ApiPublishStatus.PRIVATE)
    owner = ApiOwner.HYBRID_CLOUD
    authentication_classes = ()
    permission_classes = ()
    log_extra: dict[str, str | int]
    enforce_rate_limit = False
    """
    This endpoint is used to proxy requests from cell silos to the third-party
    integration on behalf of credentials stored in the control silo.
    """

    def __init__(self):
        super().__init__()
        self.log_extra = dict()

    @property
    def client(self):
        """
        We need to use a property decorator and setter here to overwrite it for tests.
        """
        return self._client

    @client.setter
    def client(self, client):
        self._client = client

    def _add_metric(
        self,
        metric_name: str,
        sample_rate: float | None = None,
        tags: Tags | None = None,
    ):
        if sample_rate is None:
            sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE

        metrics.incr(
            f"{METRIC_PREFIX}.{metric_name}",
            sample_rate=sample_rate,
            tags=tags,
        )

    def _add_failure_metric(
        self,
        failure_type: IntegrationProxyFailureMetricType,
        additional_tags: dict[str, str] | None = None,
    ):
        if additional_tags is None:
            additional_tags = {}
        tags = {"failure_type": failure_type, **additional_tags}

        self._add_metric(
            metric_name="proxy_failure",
            sample_rate=1.0,
            tags=tags,
        )

    def _validate_sender(self, request: HttpRequest) -> bool:
        """
        Returns True if the sender is deemed sufficiently trustworthy.
        """
        signature = request.headers.get(PROXY_SIGNATURE_HEADER)
        identifier = request.headers.get(PROXY_OI_HEADER)
        base_url = request.headers.get(PROXY_BASE_URL_HEADER)
        if signature is None or identifier is None or base_url is None:
            logger.info("integration_proxy.invalid_sender_headers", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_SENDER_HEADERS)
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
            self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_SENDER_SIGNATURE)

        return is_valid

    def _validate_request(self, request: HttpRequest) -> bool:
        """
        Returns True if a client could be generated from the request
        """
        from sentry.shared_integrations.client.proxy import IntegrationProxyClient

        # Get the organization integration
        org_integration_id_header = request.headers.get(PROXY_OI_HEADER)
        if org_integration_id_header is None or not org_integration_id_header.isdecimal():
            logger.info("integration_proxy.missing_org_integration", extra=self.log_extra)
            return False
        org_integration_id = int(org_integration_id_header)
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
            self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION)
            return False
        self.log_extra["integration_id"] = self.org_integration.integration_id

        # Get the integration
        self.integration = self.org_integration.integration
        if not self.integration or self.integration.status is not ObjectStatus.ACTIVE:
            logger.info("integration_proxy.invalid_integration", extra=self.log_extra)
            if self.integration and self.integration.status is not ObjectStatus.ACTIVE:
                self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_INTEGRATION)
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
            self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_CLIENT)
            return False

        return True

    def _should_operate(self, request: HttpRequest) -> bool:
        """
        Returns True if this endpoint should proxy the incoming integration request.
        """
        is_correct_silo = SiloMode.get_current_mode() == SiloMode.CONTROL
        if not is_correct_silo:
            self.log_extra["silo_mode"] = SiloMode.get_current_mode().value
            logger.info("integration_proxy.incorrect_silo_mode", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_MODE)
            return False

        is_valid_sender = self._validate_sender(request=request)
        if not is_valid_sender:
            logger.info("integration_proxy.failure.invalid_sender", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_SENDER)
            return False

        is_valid_request = self._validate_request(request=request)
        if not is_valid_request:
            logger.info("integration_proxy.failure.invalid_request", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_REQUEST)
            return False
        return True

    @trace
    def _call_third_party_api(
        self, request: HttpRequest, full_url: str, headers: MutableMapping[str, str]
    ) -> StreamingHttpResponse:
        prepared_request = Request(
            method=request.method, url=full_url, headers=headers, data=request.body
        ).prepare()

        # Honor the timeout the original caller forwarded so the downstream
        # request can stay open as long as intended. Falls back to the client's
        # default timeout when the header is absent or unparseable.
        timeout = decode_proxy_timeout(request.headers.get(PROXY_TIMEOUT_HEADER))

        resp: Response = self.client.request(
            request.method,
            self.proxy_path,
            allow_text=True,
            prepared_request=prepared_request,
            raw_response=True,
            stream=True,
            timeout=timeout,
        )

        def iter_response(response: Response) -> Generator[bytes]:
            with response as r:
                try:
                    yield from r.iter_content(16 * 1024)
                except (RequestException, ConnectionError, OSError) as e:
                    logger.warning(
                        "integrations.proxy.stream_interrupted",
                        extra={"error": str(e), "url": full_url},
                    )
                    return

        return StreamingHttpResponse(
            iter_response(resp),
            status=resp.status_code,
            headers=clean_outbound_headers(resp.headers),
            reason=resp.reason,
        )

    @trace(op="integration_proxy.http_method_not_allowed")
    def http_method_not_allowed(self, request):
        """
        Catch-all workaround instead of explicitly setting handlers for each method (GET, POST, etc.)
        """
        with IntegrationProxyEvent(
            interaction_type=IntegrationProxyEventType.SHOULD_PROXY
        ).capture() as lifecycle:
            # Removes leading slashes as it can result in incorrect urls being generated
            self.proxy_path = trim_leading_slashes(request.headers.get(PROXY_PATH, ""))
            self.log_extra["method"] = request.method
            self.log_extra["path"] = self.proxy_path
            self.log_extra["host"] = request.headers.get("Host")

            if not self._should_operate(request):
                lifecycle.record_failure(
                    failure_reason=IntegrationProxyFailureMetricType.FAILED_VALIDATION
                )
                return HttpResponseBadRequest()

            self._add_metric(
                metric_name=IntegrationProxySuccessMetricType.INITIALIZE, sample_rate=1.0
            )

            base_url = request.headers.get(PROXY_BASE_URL_HEADER)
            base_url = base_url.rstrip("/")

            full_url = urljoin(f"{base_url}/", self.proxy_path)
            self.log_extra["full_url"] = full_url
            headers = clean_outbound_headers(request.headers)

        with IntegrationProxyEvent(
            interaction_type=IntegrationProxyEventType.PROXY_REQUEST
        ).capture() as lifecycle:
            if self.org_integration is not None:
                lifecycle.add_extras(
                    {
                        "integration_id": self.org_integration.integration_id,
                        "organization_id": self.org_integration.organization_id,
                    }
                )
            if self.integration is not None:
                lifecycle.add_extras({"provider": self.integration.provider})

            response = self._call_third_party_api(
                request=request, full_url=full_url, headers=headers
            )

        self._add_metric(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            sample_rate=1.0,
            tags={"status": response.status_code},
        )
        return response

    def handle_exception_with_details(
        self,
        request: DRFRequest,
        exc: Exception,
        handler_context: Mapping[str, Any] | None = None,
        scope: Scope | None = None,
    ) -> DRFResponse:
        if isinstance(exc, IdentityNotValid):
            logger.warning("hybrid_cloud.integration_proxy.invalid_identity", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.INVALID_IDENTITY)
            return self.respond(status=400)
        elif isinstance(exc, ApiHostError):
            logger.info(
                "hybrid_cloud.integration_proxy.host_unreachable_error", extra=self.log_extra
            )
            self._add_failure_metric(IntegrationProxyFailureMetricType.HOST_UNREACHABLE_ERROR)
            return self.respond(status=exc.code)
        elif isinstance(exc, ApiTimeoutError):
            logger.info("hybrid_cloud.integration_proxy.host_timeout_error", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.HOST_TIMEOUT_ERROR)
            return self.respond(status=exc.code)
        elif isinstance(exc, ApiUnauthorized):
            logger.info("hybrid_cloud.integration_proxy.unauthorized_error", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.UNAUTHORIZED_ERROR)
            return self.respond(status=exc.code)
        elif isinstance(exc, ApiRateLimitedError):
            logger.info("hybrid_cloud.integration_proxy.rate_limited_error", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.RATE_LIMITED_ERROR)
            return self.respond(status=exc.code)
        elif isinstance(exc, ApiForbiddenError):
            logger.info("hybrid_cloud.integration_proxy.forbidden_error", extra=self.log_extra)
            self._add_failure_metric(IntegrationProxyFailureMetricType.FORBIDDEN_ERROR)
            return self.respond(status=exc.code)

        logger.warning(
            "hybrid_cloud.integration_proxy.unknown_error",
            extra={**self.log_extra, "exception_class": type(exc).__name__},
        )
        self._add_failure_metric(IntegrationProxyFailureMetricType.UNKNOWN_ERROR)
        return super().handle_exception_with_details(request, exc, handler_context, scope)

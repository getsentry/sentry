from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Generator, Mapping
from enum import StrEnum
from typing import Any, MutableMapping, TypedDict
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
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.utils.metrics import IntegrationProxyEvent, IntegrationProxyEventType
from sentry.metrics.base import Tags
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
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
    INVALID_ORG_INTEGRATION_HEADERS = "invalid_org_integration_headers"
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


def _add_metric(
    metric_name: str,
    sample_rate: float | None = None,
    tags: Tags | None = None,
) -> None:
    if sample_rate is None:
        sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE

    metrics.incr(
        f"{METRIC_PREFIX}.{metric_name}",
        sample_rate=sample_rate,
        tags=tags,
    )


def _add_failure_metric(
    failure_type: IntegrationProxyFailureMetricType,
    additional_tags: dict[str, str] | None = None,
) -> None:
    if additional_tags is None:
        additional_tags = {}
    tags = {"failure_type": failure_type.value, **additional_tags}

    _add_metric(
        metric_name="proxy_failure",
        sample_rate=1.0,
        tags=tags,
    )


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


class IntegrationProxyRequestValidationContext(TypedDict):
    integration_id: int | None
    organization_id: int | None


class IntegrationProxyRequestValidationException(Exception):
    failure_type: IntegrationProxyFailureMetricType
    integration_context: IntegrationProxyRequestValidationContext

    def __init__(
        self,
        failure_type: IntegrationProxyFailureMetricType,
        integration_context: IntegrationProxyRequestValidationContext,
    ):
        super().__init__(f"Integration proxy request validation failed: {failure_type.value}")
        self.failure_type = failure_type
        self.integration_context = integration_context


class IntegrationProxyRequestValidator:
    """
    Class that validates an integration proxy request, and unpacks the integration, organization integration,
     and instantiates a new installation from the request.

    Validation runs once, during construction. If any portion of the request
    validation fails, an IntegrationProxyRequestValidationException is raised.
    """

    proxy_path: str
    log_context: dict[str, Any]

    # Populated by the validation steps below; each stays None if validation never got that far.
    integration: Integration
    organization_integration: OrganizationIntegration
    integration_installation: IntegrationInstallation
    client: IntegrationProxyClient

    def __init__(self, request: HttpRequest):
        self.request = request
        # Removes leading slashes as it can result in incorrect urls being generated
        self.proxy_path = trim_leading_slashes(request.headers.get(PROXY_PATH, ""))
        self.log_context = {
            "method": request.method,
            "path": self.proxy_path,
            "host": request.headers.get("Host"),
        }

        self._validate()

        # A successful validation must have resolved every object the proxy needs.
        assert self.organization_integration is not None, (
            "Expected validated request to have an organization integration"
        )
        assert self.integration is not None, "Expected validated request to have an integration"
        assert self.integration_installation is not None, (
            "Expected validated request to have an integration installation"
        )
        assert self.client is not None, "Expected validated request to have a client"

    def _validate(self):
        """
        Validates various components of the request to ensure the sender is both
        trustworthy, and the request can be authenticated using the appropriate
        integration credentials.

        Post-validation, exposes the validated integration, org integration, and
        install, along with a client that can be used to proxy the request.
        """
        self._validate_silo_mode()
        self._validate_sender()
        self._validate_and_set_organization_integration()
        self._validate_and_set_integration_installation()
        self._validate_and_set_client()

    def _validate_silo_mode(self):
        is_correct_silo = SiloMode.get_current_mode() == SiloMode.CONTROL
        if not is_correct_silo:
            self.log_context["silo_mode"] = SiloMode.get_current_mode().value
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_MODE,
                integration_context={
                    "integration_id": None,
                    "organization_id": None,
                },
            )

    def _get_integration_context(self) -> IntegrationProxyRequestValidationContext:
        integration = getattr(self, "integration", None)
        organization_integration = getattr(self, "organization_integration", None)
        return {
            "integration_id": integration.id if integration else None,
            "organization_id": organization_integration.organization_id
            if organization_integration
            else None,
        }

    def _validate_sender(self):
        """
        Returns True if the sender is deemed sufficiently trustworthy. A sender is considered trustworthy if they:
            - Have a valid signature
            - Can be mapped definitively to an integration and organization
            - Have a valid subnet signature
        """
        request = self.request
        signature = request.headers.get(PROXY_SIGNATURE_HEADER)
        identifier = request.headers.get(PROXY_OI_HEADER)
        base_url = request.headers.get(PROXY_BASE_URL_HEADER)
        if signature is None or identifier is None or base_url is None:
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_SENDER_HEADERS,
                integration_context={
                    **self._get_integration_context(),
                },
            )
        is_valid = verify_subnet_signature(
            base_url=base_url,
            path=self.proxy_path,
            identifier=identifier,
            request_body=request.body,
            provided_signature=signature,
        )
        if not is_valid:
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_SENDER_SIGNATURE,
                integration_context={
                    "integration_id": None,
                    "organization_id": None,
                },
            )

    def _validate_and_set_organization_integration(self):
        """
        Extracts the organization integration id from the request headers and resolves it to an
        active OrganizationIntegration, which is set on the validator.
        """
        request = self.request
        org_integration_id_header = request.headers.get(PROXY_OI_HEADER)
        if org_integration_id_header is None or not org_integration_id_header.isdecimal():
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION_HEADERS,
                integration_context={
                    **self._get_integration_context(),
                },
            )
        org_integration_id = int(org_integration_id_header)

        org_integration = (
            OrganizationIntegration.objects.filter(
                id=org_integration_id,
                status=ObjectStatus.ACTIVE,
            )
            .select_related("integration")
            .first()
        )
        if org_integration is None:
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION,
                integration_context={
                    **self._get_integration_context(),
                },
            )

        self.organization_integration = org_integration

    def _validate_and_set_integration_installation(self):
        """
        Checks that the resolved organization integration points at an active integration, then
        instantiates that integration's installation. Both are set on the validator.
        """
        org_integration = self.organization_integration
        if org_integration is None:
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION,
                integration_context={
                    **self._get_integration_context(),
                },
            )

        integration = org_integration.integration
        self.integration = integration
        if not integration or integration.status is not ObjectStatus.ACTIVE:
            logger.info("integration_proxy.invalid_integration", extra=self.log_context)
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_INTEGRATION,
                integration_context={
                    **self._get_integration_context(),
                },
            )

        self.integration_installation = integration.get_installation(
            organization_id=org_integration.organization_id
        )

    def _validate_and_set_client(self):
        """
        Acquires the API client from the installation and sets it on the validator. Returns True only
        if that client can actually proxy requests.
        """
        installation = self.integration_installation
        if installation is None:
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_CLIENT,
                integration_context={
                    **self._get_integration_context(),
                },
            )

        # Some integrations use a keyring approach, so we need to pass in the keyid
        keyid = self.request.headers.get(PROXY_KEYID_HEADER)
        if keyid:
            self.client = installation.get_keyring_client(keyid)
        else:
            self.client = installation.get_client()

        if not isinstance(self.client, IntegrationProxyClient):
            raise IntegrationProxyRequestValidationException(
                failure_type=IntegrationProxyFailureMetricType.INVALID_CLIENT,
                integration_context={
                    **self._get_integration_context(),
                },
            )


@internal_control_silo_endpoint
class InternalIntegrationProxyEndpoint(Endpoint):
    content_negotiation_class = _PassthroughContentNegotiation
    publish_status = defaultdict(lambda: ApiPublishStatus.PRIVATE)
    owner = ApiOwner.HYBRID_CLOUD
    authentication_classes = ()
    permission_classes = ()
    log_extra: dict[str, Any]
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
            try:
                validator = IntegrationProxyRequestValidator(request)
            except IntegrationProxyRequestValidationException as e:
                lifecycle.record_failure(
                    failure_reason=e.failure_type.value, extra={**e.integration_context}
                )
                _add_failure_metric(
                    failure_type=e.failure_type,
                )
                return HttpResponseBadRequest()

            self.proxy_path = validator.proxy_path
            # Share the validator's dict so keys added on either side are logged together.
            self.log_extra = validator.log_context

            self.client = validator.client

            _add_metric(metric_name=IntegrationProxySuccessMetricType.INITIALIZE, sample_rate=1.0)

            base_url = request.headers.get(PROXY_BASE_URL_HEADER)
            base_url = base_url.rstrip("/")

            full_url = urljoin(f"{base_url}/", self.proxy_path)
            self.log_extra["full_url"] = full_url
            headers = clean_outbound_headers(request.headers)

        with IntegrationProxyEvent(
            interaction_type=IntegrationProxyEventType.PROXY_REQUEST
        ).capture() as lifecycle:
            org_integration = validator.organization_integration
            if org_integration is not None:
                lifecycle.add_extras(
                    {
                        "integration_id": org_integration.integration_id,
                        "organization_id": org_integration.organization_id,
                    }
                )
            integration = validator.integration
            if integration is not None:
                lifecycle.add_extras({"provider": integration.provider})

            response = self._call_third_party_api(
                request=request, full_url=full_url, headers=headers
            )

        _add_metric(
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
            _add_failure_metric(IntegrationProxyFailureMetricType.INVALID_IDENTITY)
            return self.respond(status=400)
        elif isinstance(exc, ApiHostError):
            logger.info(
                "hybrid_cloud.integration_proxy.host_unreachable_error", extra=self.log_extra
            )
            _add_failure_metric(IntegrationProxyFailureMetricType.HOST_UNREACHABLE_ERROR)
            return self.respond(status=exc.code)
        elif isinstance(exc, ApiTimeoutError):
            logger.info("hybrid_cloud.integration_proxy.host_timeout_error", extra=self.log_extra)
            _add_failure_metric(IntegrationProxyFailureMetricType.HOST_TIMEOUT_ERROR)
            return self.respond(status=exc.code)
        elif isinstance(exc, ApiUnauthorized):
            logger.info("hybrid_cloud.integration_proxy.unauthorized_error", extra=self.log_extra)
            _add_failure_metric(IntegrationProxyFailureMetricType.UNAUTHORIZED_ERROR)
            return self.respond(status=exc.code)
        elif isinstance(exc, ApiRateLimitedError):
            logger.info("hybrid_cloud.integration_proxy.rate_limited_error", extra=self.log_extra)
            _add_failure_metric(IntegrationProxyFailureMetricType.RATE_LIMITED_ERROR)
            return self.respond(status=exc.code)
        elif isinstance(exc, ApiForbiddenError):
            logger.info("hybrid_cloud.integration_proxy.forbidden_error", extra=self.log_extra)
            _add_failure_metric(IntegrationProxyFailureMetricType.FORBIDDEN_ERROR)
            return self.respond(status=exc.code)

        logger.warning(
            "hybrid_cloud.integration_proxy.unknown_error",
            extra={**self.log_extra, "exception_class": type(exc).__name__},
        )
        _add_failure_metric(IntegrationProxyFailureMetricType.UNKNOWN_ERROR)
        return super().handle_exception_with_details(request, exc, handler_context, scope)

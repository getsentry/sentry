from __future__ import annotations

from collections.abc import Generator
from typing import Any, TypedDict, Unpack
from unittest.mock import MagicMock, Mock, patch

import pytest
from django.http.request import HttpHeaders
from django.test import RequestFactory, override_settings
from requests import Response

from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.api.endpoints.integration_proxy import (
    IntegrationProxyFailureMetricType,
    IntegrationProxyRequestValidationException,
    IntegrationProxyRequestValidator,
    IntegrationProxySuccessMetricType,
    InternalIntegrationProxyEndpoint,
)
from sentry.integrations.client import ApiClient
from sentry.integrations.example.integration import ExampleIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.types import EventLifecycleOutcome
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
    PROXY_BASE_PATH,
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    encode_subnet_signature,
)
from sentry.testutils.asserts import assert_count_of_metric, assert_failure_metric
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import metrics


class SiloHttpHeaders(TypedDict, total=False):
    HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION: str
    HTTP_X_SENTRY_SUBNET_SIGNATURE: str
    HTTP_X_SENTRY_SUBNET_BASE_URL: str
    HTTP_X_SENTRY_SUBNET_PATH: str
    HTTP_X_SENTRY_SUBNET_TIMEOUT: str
    HTTP_X_SENTRY_SUBNET_KEYID: str


def create_request_headers(
    secret: str,
    signature_path: str,
    integration_id: int | None = None,
    request_body=b"",
    base_url="https://example.com/api",
):
    signature = encode_subnet_signature(
        secret=secret,
        base_url=base_url,
        path=signature_path,
        identifier=str(integration_id),
        request_body=request_body,
    )

    return SiloHttpHeaders(
        HTTP_X_SENTRY_SUBNET_BASE_URL=base_url,
        HTTP_X_SENTRY_SUBNET_SIGNATURE=signature,
        HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(integration_id),
        HTTP_X_SENTRY_SUBNET_PATH=signature_path,
    )


def test_ensure_http_headers_match() -> None:
    headers = SiloHttpHeaders(
        HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION="hello",
        HTTP_X_SENTRY_SUBNET_SIGNATURE="world",
    )

    def cgi_header(s: str) -> str:
        """
        Django requests cannot be initialized without request factory, and headers for those requests
        must follow the CGI spec. This means _ (instead of -) and prefixed with 'HTTP_'

        https://docs.djangoproject.com/en/4.0/topics/testing/tools/#making-requests
        """
        return f"{HttpHeaders.HTTP_PREFIX}{s.replace('-', '_')}".upper()

    expected = {cgi_header(s) for s in (PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER)}
    assert set(headers) == expected


SENTRY_SUBNET_SECRET = "hush-hush-im-invisible"


@control_silo_test
class InternalIntegrationProxyEndpointTest(APITestCase):
    endpoint = "sentry-api-0-internal-integration-proxy"
    secret = SENTRY_SUBNET_SECRET

    def setUp(self) -> None:
        self.factory = RequestFactory()
        self.proxy_path = "chat.postMessage"
        self.path = f"{PROXY_BASE_PATH}/"
        self.integration = self.create_integration(
            self.organization, external_id="example:1", provider="example"
        )
        self.org_integration = OrganizationIntegration.objects.get(
            integration_id=self.integration.id
        )

        self.valid_header_kwargs = create_request_headers(
            self.secret, integration_id=self.org_integration.id, signature_path=self.proxy_path
        )
        self.valid_request = self.factory.get(self.path, **self.valid_header_kwargs)

    def assert_metric_count(
        self,
        *,
        metric_name: str,
        count: int,
        mock_metrics: MagicMock,
        metric_prefix: str = "hybrid_cloud.integration_proxy",
        kwargs_to_match: dict[str, Any] | None = None,
    ):
        metric_name = f"{metric_prefix}.{metric_name}"
        logged_metrics = {call.args[0] for call in mock_metrics.call_args_list}

        metric_in_set = metric_name in logged_metrics

        # Depending on the count, we assert the metric is in the set or not
        if count == 0:
            assert not metric_in_set, f"Metric {metric_name} found in {logged_metrics}"
        else:
            assert metric_in_set, f"Metric {metric_name} not found in {logged_metrics}"

        # Finding matching metric calls with the same name
        matching_mock_calls = [
            call for call in mock_metrics.call_args_list if call.args[0] == metric_name
        ]
        assert len(matching_mock_calls) == count

        if kwargs_to_match is not None:
            for call in matching_mock_calls:
                assert call.kwargs == kwargs_to_match

    def assert_failure_metric_count(
        self,
        *,
        failure_type: IntegrationProxyFailureMetricType,
        count: int,
        mock_metrics: MagicMock,
        tags: Tags | None = None,
    ):
        metric_name = "hybrid_cloud.integration_proxy.proxy_failure"
        expected_tags = {"failure_type": failure_type, **(tags or {})}

        # Filter on the failure_type tag, since a single validation pass can emit more than
        # one proxy_failure metric (a specific reason plus the wrapping category).
        matching_mock_calls = [
            call
            for call in mock_metrics.call_args_list
            if call.args[0] == metric_name and call.kwargs.get("tags") == expected_tags
        ]
        logged_metrics = [
            (call.args[0], call.kwargs.get("tags")) for call in mock_metrics.call_args_list
        ]
        assert len(matching_mock_calls) == count, (
            f"Expected {count} {failure_type} metric(s), found {len(matching_mock_calls)} in {logged_metrics}"
        )

        for call in matching_mock_calls:
            assert call.kwargs["sample_rate"] == 1.0

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        content = str({"some": "data"}).encode("utf-8")
        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.content = content
        mock_response.status_code = 400
        mock_response.reason = "Bad Request"
        mock_response.headers = {
            "Content-Type": "application/json",
            "X-Arbitrary": "Value",
            PROXY_SIGNATURE_HEADER: "123",
        }
        mock_response.iter_content = MagicMock(return_value=iter([content]))

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        prepared_request = mock_client.request.call_args.kwargs["prepared_request"]
        assert prepared_request.url == "https://example.com/api/chat.postMessage"

        assert b"".join(proxy_response.streaming_content) == content
        assert proxy_response.status_code == mock_response.status_code
        assert proxy_response.reason_phrase == mock_response.reason
        assert proxy_response["Content-Type"] == mock_response.headers["Content-Type"]
        assert proxy_response["X-Arbitrary"] == mock_response.headers["X-Arbitrary"]
        assert proxy_response.get(PROXY_SIGNATURE_HEADER) is None

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": {"status": 400}},
        )

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_forwards_timeout(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )
        headers["HTTP_X_SENTRY_SUBNET_TIMEOUT"] = "90.0"

        content = b"{}"
        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.content = content
        mock_response.status_code = 200
        mock_response.reason = "OK"
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.iter_content = MagicMock(return_value=iter([content]))

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        self.client.get(self.path, **headers)

        # The caller's timeout is decoded and forwarded to the downstream request.
        assert mock_client.request.call_args.kwargs["timeout"] == 90.0

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_without_timeout_header(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        content = b"{}"
        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.content = content
        mock_response.status_code = 200
        mock_response.reason = "OK"
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.iter_content = MagicMock(return_value=iter([content]))

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        self.client.get(self.path, **headers)

        # Absent header -> None, so the client falls back to its own default timeout.
        assert mock_client.request.call_args.kwargs["timeout"] is None

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_with_different_base_url(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
            base_url="https://foobar.example.com/api",
        )

        content = str({"some": "data"}).encode("utf-8")
        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.content = content
        mock_response.status_code = 400
        mock_response.reason = "Bad Request"
        mock_response.headers = {
            "Content-Type": "application/json",
            "X-Arbitrary": "Value",
            PROXY_SIGNATURE_HEADER: "123",
        }
        mock_response.iter_content = MagicMock(return_value=iter([content]))

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        prepared_request = mock_client.request.call_args.kwargs["prepared_request"]
        assert prepared_request.url == "https://foobar.example.com/api/chat.postMessage"

        assert b"".join(proxy_response.streaming_content) == content
        assert proxy_response.status_code == mock_response.status_code
        assert proxy_response.reason_phrase == mock_response.reason
        assert proxy_response["Content-Type"] == mock_response.headers["Content-Type"]
        assert proxy_response["X-Arbitrary"] == mock_response.headers["X-Arbitrary"]
        assert proxy_response.get(PROXY_SIGNATURE_HEADER) is None

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": {"status": 400}},
        )

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_request_with_missing_integration_id(
        self,
        mock_metrics: MagicMock,
        mock_client: MagicMock,
        mock_get_client: MagicMock,
        mock_record_event: MagicMock,
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=None,
        )

        mock_response = Mock(spec=Response)
        mock_response.content = str({"foo": "bar"}).encode("utf-8")
        mock_response.status_code = 200
        mock_response.headers = {
            "Content-Type": "application/json",
            "X-Arbitrary": "Value",
            PROXY_SIGNATURE_HEADER: "123",
        }

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 400
        assert mock_client.request.call_count == 0
        assert proxy_response.get(PROXY_SIGNATURE_HEADER) is None

        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION_HEADERS,
            count=1,
            mock_metrics=mock_metrics,
        )

        # SLO assertions
        # SHOULD_PROXY (failure)
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.FAILURE, 1)

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch.object(OrganizationIntegration, "integration", None)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_request_with_unresolvable_integration(
        self,
        mock_metrics: MagicMock,
        mock_client: MagicMock,
        mock_get_client: MagicMock,
        mock_record_event: MagicMock,
    ) -> None:
        """
        The organization integration's foreign key is non-null in the database, but guard against
        it resolving to nothing anyway rather than blowing up on a missing installation.
        """
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock()
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 400
        assert mock_client.request.call_count == 0
        assert proxy_response.get(PROXY_SIGNATURE_HEADER) is None

        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.INVALID_INTEGRATION,
            count=1,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=0,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=0,
            mock_metrics=mock_metrics,
        )

        # SLO assertions
        # SHOULD_PROXY (failure)
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.FAILURE, 1)

    def raise_exception(self, exc_type: type[Exception], *args, **kwargs):
        raise exc_type(*args)

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_handles_identity_not_valid(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret, signature_path=signature_path, integration_id=self.org_integration.id
        )
        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(
            side_effect=lambda *args, **kwargs: self.raise_exception(exc_type=IdentityNotValid)
        )
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 400
        assert proxy_response.data is None

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.INVALID_IDENTITY,
            count=1,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=0,
            mock_metrics=mock_metrics,
        )

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_handles_api_host_errors(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret, signature_path=signature_path, integration_id=self.org_integration.id
        )
        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(
            side_effect=lambda *args, **kwargs: self.raise_exception(
                ApiHostError, "API request failed"
            )
        )
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 503
        assert proxy_response.data is None

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.HOST_UNREACHABLE_ERROR,
            count=1,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=0,
            mock_metrics=mock_metrics,
            kwargs_to_match={"tags": None},
        )

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_handles_api_timeout_error(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret, signature_path=signature_path, integration_id=self.org_integration.id
        )
        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(
            side_effect=lambda *args, **kwargs: self.raise_exception(
                ApiTimeoutError, "API request timed out"
            )
        )
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 504
        assert proxy_response.data is None

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.HOST_TIMEOUT_ERROR,
            count=1,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=0,
            mock_metrics=mock_metrics,
        )

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_handles_api_unauthorized_error(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret, signature_path=signature_path, integration_id=self.org_integration.id
        )
        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(
            side_effect=lambda *args, **kwargs: self.raise_exception(
                ApiUnauthorized, "Unauthorized"
            )
        )
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 401
        assert proxy_response.data is None

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.UNAUTHORIZED_ERROR,
            count=1,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=0,
            mock_metrics=mock_metrics,
        )

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_handles_api_rate_limited_error(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret, signature_path=signature_path, integration_id=self.org_integration.id
        )
        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(
            side_effect=lambda *args, **kwargs: self.raise_exception(
                ApiRateLimitedError, "Rate limited"
            )
        )
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 429
        assert proxy_response.data is None

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.RATE_LIMITED_ERROR,
            count=1,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=0,
            mock_metrics=mock_metrics,
        )

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_handles_api_forbidden_error(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret, signature_path=signature_path, integration_id=self.org_integration.id
        )
        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(
            side_effect=lambda *args, **kwargs: self.raise_exception(ApiForbiddenError, "Forbidden")
        )
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 403
        assert proxy_response.data is None

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.FORBIDDEN_ERROR,
            count=1,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=0,
            mock_metrics=mock_metrics,
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_returns_500_for_unexpected_error(
        self,
        mock_metrics: MagicMock,
        mock_client: MagicMock,
        mock_get_client: MagicMock,
        mock_record_event: MagicMock,
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret, signature_path=signature_path, integration_id=self.org_integration.id
        )
        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(
            side_effect=lambda *args, **kwargs: self.raise_exception(exc_type=Exception)
        )
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 500

        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.INITIALIZE,
            count=1,
            mock_metrics=mock_metrics,
            kwargs_to_match={"sample_rate": 1.0, "tags": None},
        )
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.UNKNOWN_ERROR,
            count=1,
            mock_metrics=mock_metrics,
        )
        self.assert_metric_count(
            metric_name=IntegrationProxySuccessMetricType.COMPLETE_RESPONSE_CODE,
            count=0,
            mock_metrics=mock_metrics,
        )

        # SLO assertions
        # SHOULD_PROXY (success) -> PROXY_REQUEST (failure)
        assert_failure_metric(mock_record_event, Exception("Unknown error"))
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.STARTED, 2)
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.SUCCESS, 1)
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.FAILURE, 1)

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_with_non_json_accept_header(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        content = b"<html><body>Hello</body></html>"
        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.content = content
        mock_response.status_code = 200
        mock_response.reason = "OK"
        mock_response.headers = {
            "Content-Type": "text/html",
            "X-Arbitrary": "Value",
        }
        mock_response.iter_content = MagicMock(return_value=iter([content]))

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers, HTTP_ACCEPT="text/html")

        assert proxy_response.status_code == 200
        assert b"".join(proxy_response.streaming_content) == content
        assert proxy_response["Content-Type"] == "text/html"
        assert proxy_response["X-Arbitrary"] == "Value"

        prepared_request = mock_client.request.call_args.kwargs["prepared_request"]
        assert prepared_request.url == "https://example.com/api/chat.postMessage"

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_with_octet_stream_accept_header(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        content = b"\x00\x01\x02\x03binary-data"
        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.content = content
        mock_response.status_code = 200
        mock_response.reason = "OK"
        mock_response.headers = {
            "Content-Type": "application/octet-stream",
        }
        mock_response.iter_content = MagicMock(return_value=iter([content]))

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(
            self.path, **headers, HTTP_ACCEPT="application/octet-stream"
        )

        assert proxy_response.status_code == 200
        assert b"".join(proxy_response.streaming_content) == content
        assert proxy_response["Content-Type"] == "application/octet-stream"

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_with_xml_accept_header(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        content = b"<response><status>ok</status></response>"
        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.content = content
        mock_response.status_code = 200
        mock_response.reason = "OK"
        mock_response.headers = {
            "Content-Type": "application/xml",
        }
        mock_response.iter_content = MagicMock(return_value=iter([content]))

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers, HTTP_ACCEPT="application/xml")

        assert proxy_response.status_code == 200
        assert b"".join(proxy_response.streaming_content) == content
        assert proxy_response["Content-Type"] == "application/xml"

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_stream_interrupted(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        from requests.exceptions import ChunkedEncodingError

        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        first_chunk = b"partial-"

        def iter_then_raise(chunk_size):
            yield first_chunk
            raise ChunkedEncodingError("connection reset")

        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.status_code = 200
        mock_response.reason = "OK"
        mock_response.headers = {"Content-Type": "application/octet-stream"}
        mock_response.iter_content = iter_then_raise

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(
            self.path, **headers, HTTP_ACCEPT="application/octet-stream"
        )

        assert proxy_response.status_code == 200
        assert b"".join(proxy_response.streaming_content) == first_chunk

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy_stream_connection_reset(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = create_request_headers(
            self.secret,
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        def iter_then_reset(chunk_size: int) -> Generator[bytes]:
            if True:
                raise ConnectionResetError("peer closed connection")
            yield b""  # type: ignore[unreachable]

        mock_response = MagicMock(spec=Response)
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.status_code = 200
        mock_response.reason = "OK"
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.iter_content = iter_then_reset

        mock_client.base_url = "https://example.com/api"
        mock_client.authorize_request = MagicMock(side_effect=lambda req: req)
        mock_client.request = MagicMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        proxy_response = self.client.get(self.path, **headers)

        assert proxy_response.status_code == 200
        assert b"".join(proxy_response.streaming_content) == b""


@control_silo_test
class IntegrationProxyRequestValidatorTest(TestCase):
    secret = SENTRY_SUBNET_SECRET

    def setUp(self) -> None:
        self.factory = RequestFactory()
        self.proxy_path = "chat.postMessage"
        self.path = f"{PROXY_BASE_PATH}/"
        self.integration = self.create_integration(
            self.organization, external_id="example:1", provider="example"
        )
        self.org_integration = OrganizationIntegration.objects.get(
            integration_id=self.integration.id
        )

    def build_request(self, **extra_headers: Unpack[SiloHttpHeaders]):
        """
        Build a request with a valid subnet signature over the default proxy path, letting
        individual tests override single headers to exercise each validation failure.
        """
        header_kwargs = create_request_headers(
            self.secret, signature_path=self.proxy_path, integration_id=self.org_integration.id
        )
        header_kwargs.update(extra_headers)
        return self.factory.get(self.path, **header_kwargs)

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(metrics, "incr")
    def test_valid_request(self, mock_metrics: MagicMock, mock_get_client: MagicMock) -> None:
        proxy_client = IntegrationProxyClient(org_integration_id=self.org_integration.id)
        mock_get_client.return_value = proxy_client

        validator = IntegrationProxyRequestValidator(self.build_request())

        assert validator.integration == self.integration
        assert validator.organization_integration == self.org_integration
        assert isinstance(validator.integration_installation, ExampleIntegration)
        assert validator.client is proxy_client

        assert validator.proxy_path == self.proxy_path

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    def test_strips_leading_slashes_from_proxy_path(self, mock_get_client: MagicMock) -> None:
        mock_get_client.return_value = IntegrationProxyClient(
            org_integration_id=self.org_integration.id
        )
        request = self.build_request(HTTP_X_SENTRY_SUBNET_PATH=f"/{self.proxy_path}")
        validator = IntegrationProxyRequestValidator(request)

        assert validator.proxy_path == self.proxy_path
        # The signature is verified against the trimmed path, so it still checks out.

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CELL)
    @patch.object(metrics, "incr")
    def test_incorrect_silo_mode(self, mock_metrics: MagicMock) -> None:
        with pytest.raises(
            IntegrationProxyRequestValidationException,
            match=IntegrationProxyFailureMetricType.INVALID_MODE.value,
        ) as cm:
            IntegrationProxyRequestValidator(self.build_request())

        assert cm.value.failure_type == IntegrationProxyFailureMetricType.INVALID_MODE

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(metrics, "incr")
    def test_missing_sender_headers(self, mock_metrics: MagicMock) -> None:
        request = self.factory.get(self.path, **SiloHttpHeaders())
        with pytest.raises(
            IntegrationProxyRequestValidationException,
            match=IntegrationProxyFailureMetricType.INVALID_SENDER_HEADERS.value,
        ) as cm:
            IntegrationProxyRequestValidator(request)

        assert cm.value.failure_type == IntegrationProxyFailureMetricType.INVALID_SENDER_HEADERS

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(metrics, "incr")
    def test_non_decimal_org_integration_header(self, mock_metrics: MagicMock) -> None:
        header_kwargs = create_request_headers(
            self.secret, signature_path=self.proxy_path, integration_id=None
        )
        with pytest.raises(
            IntegrationProxyRequestValidationException,
            match=IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION_HEADERS.value,
        ) as cm:
            IntegrationProxyRequestValidator(self.factory.get(self.path, **header_kwargs))

        assert (
            cm.value.failure_type
            == IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION_HEADERS
        )

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(metrics, "incr")
    def test_inactive_org_integration(self, mock_metrics: MagicMock) -> None:
        self.org_integration.update(status=ObjectStatus.DISABLED)
        with pytest.raises(
            IntegrationProxyRequestValidationException,
            match=IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION.value,
        ) as cm:
            IntegrationProxyRequestValidator(self.build_request())

        assert cm.value.failure_type == IntegrationProxyFailureMetricType.INVALID_ORG_INTEGRATION

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(metrics, "incr")
    def test_inactive_integration(self, mock_metrics: MagicMock) -> None:
        self.integration.update(status=ObjectStatus.DISABLED)
        with pytest.raises(
            IntegrationProxyRequestValidationException,
            match=IntegrationProxyFailureMetricType.INVALID_INTEGRATION.value,
        ) as cm:
            IntegrationProxyRequestValidator(self.build_request())

        assert cm.value.failure_type == IntegrationProxyFailureMetricType.INVALID_INTEGRATION

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(OrganizationIntegration, "integration", None)
    @patch.object(metrics, "incr")
    def test_unresolvable_integration(self, mock_metrics: MagicMock) -> None:
        with pytest.raises(
            IntegrationProxyRequestValidationException,
            match=IntegrationProxyFailureMetricType.INVALID_INTEGRATION.value,
        ) as cm:
            IntegrationProxyRequestValidator(self.build_request())

        assert cm.value.failure_type == IntegrationProxyFailureMetricType.INVALID_INTEGRATION
        assert cm.value.integration_context["integration_id"] is None
        assert cm.value.integration_context["organization_id"] == self.organization.id

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(Integration, "get_installation")
    @patch.object(metrics, "incr")
    def test_non_proxy_client(
        self, mock_metrics: MagicMock, mock_get_installation: MagicMock
    ) -> None:
        mock_get_installation().get_client = MagicMock(return_value=ApiClient())
        with pytest.raises(
            IntegrationProxyRequestValidationException,
            match=IntegrationProxyFailureMetricType.INVALID_CLIENT.value,
        ) as cm:
            IntegrationProxyRequestValidator(self.build_request())

        assert cm.value.failure_type == IntegrationProxyFailureMetricType.INVALID_CLIENT

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(Integration, "get_installation")
    def test_uses_keyring_client_when_keyid_present(self, mock_get_installation: MagicMock) -> None:
        keyring_client = IntegrationProxyClient(org_integration_id=self.org_integration.id)
        mock_installation = mock_get_installation.return_value
        mock_installation.get_keyring_client = MagicMock(return_value=keyring_client)
        mock_installation.get_client = MagicMock(return_value=ApiClient())

        request = self.build_request(HTTP_X_SENTRY_SUBNET_KEYID="12345")
        validator = IntegrationProxyRequestValidator(request)

        mock_installation.get_keyring_client.assert_called_once_with("12345")
        assert mock_installation.get_client.call_count == 0
        assert validator.client is keyring_client

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(Integration, "get_installation")
    def test_validates_once_during_construction(self, mock_get_installation: MagicMock) -> None:
        mock_get_installation.return_value.get_client = MagicMock(
            return_value=IntegrationProxyClient(org_integration_id=self.org_integration.id)
        )
        validator = IntegrationProxyRequestValidator(self.build_request())

        # Validation already ran in the constructor; the getters just read what it resolved.
        assert validator.integration == self.integration
        assert validator.organization_integration == self.org_integration
        assert validator.client is not None

        assert mock_get_installation.call_count == 1

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    def test_exception_integration_context_empty_when_invalid_request_is_made(self) -> None:
        request = self.build_request(HTTP_X_SENTRY_SUBNET_SIGNATURE="not-the-real-signature")
        with pytest.raises(
            IntegrationProxyRequestValidationException,
            match=IntegrationProxyFailureMetricType.INVALID_SENDER_SIGNATURE.value,
        ) as cm:
            IntegrationProxyRequestValidator(request)

        assert cm.value.failure_type == IntegrationProxyFailureMetricType.INVALID_SENDER_SIGNATURE

        assert cm.value.integration_context["integration_id"] is None
        assert cm.value.integration_context["organization_id"] is None

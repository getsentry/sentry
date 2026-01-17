from __future__ import annotations

from typing import Any, TypedDict
from unittest.mock import MagicMock, Mock, patch

from django.http.request import HttpHeaders
from django.test import RequestFactory, override_settings
from requests import Response

from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.api.endpoints.integration_proxy import (
    IntegrationProxyFailureMetricType,
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
from sentry.shared_integrations.exceptions import ApiHostError, ApiTimeoutError
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_BASE_PATH,
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    encode_subnet_signature,
)
from sentry.testutils.asserts import assert_count_of_metric, assert_failure_metric
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import metrics


class SiloHttpHeaders(TypedDict, total=False):
    HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION: str
    HTTP_X_SENTRY_SUBNET_SIGNATURE: str
    HTTP_X_SENTRY_SUBNET_BASE_URL: str
    HTTP_X_SENTRY_SUBNET_PATH: str


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
        self.endpoint_cls = InternalIntegrationProxyEndpoint()
        self.endpoint_cls.proxy_path = self.proxy_path
        self.path = f"{PROXY_BASE_PATH}/"
        self.integration = self.create_integration(
            self.organization, external_id="example:1", provider="example"
        )
        self.org_integration = OrganizationIntegration.objects.get(
            integration_id=self.integration.id
        )

        self.valid_header_kwargs = self.create_request_headers(
            integration_id=self.org_integration.id, signature_path=self.proxy_path
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
        metric_name = "proxy_failure"
        kwargs: dict[str, Any] = {
            "sample_rate": 1.0,
            "tags": {"failure_type": failure_type, **(tags or {})},
        }
        self.assert_metric_count(
            metric_name=metric_name,
            count=count,
            mock_metrics=mock_metrics,
            kwargs_to_match=kwargs,
        )

    def create_request_headers(
        self,
        signature_path,
        integration_id: int | None = None,
        request_body=b"",
        base_url="https://example.com/api",
    ):
        signature = encode_subnet_signature(
            secret=self.secret,
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

    @override_settings(SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET, SILO_MODE=SiloMode.CONTROL)
    @patch.object(ExampleIntegration, "get_client")
    @patch.object(InternalIntegrationProxyEndpoint, "client", spec=IntegrationProxyClient)
    @patch.object(metrics, "incr")
    def test_proxy(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = self.create_request_headers(
            signature_path=signature_path,
            integration_id=self.org_integration.id,
        )

        mock_response = Mock(spec=Response)
        mock_response.content = str({"some": "data"}).encode("utf-8")
        mock_response.status_code = 400
        mock_response.reason = "Bad Request"
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

        prepared_request = mock_client.request.call_args.kwargs["prepared_request"]
        assert prepared_request.url == "https://example.com/api/chat.postMessage"
        assert prepared_request.headers == {
            "Cookie": "",
            "Content-Type": "application/octet-stream",
        }

        assert proxy_response.content == mock_response.content
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
    def test_proxy_with_different_base_url(
        self, mock_metrics: MagicMock, mock_client: MagicMock, mock_get_client: MagicMock
    ) -> None:
        signature_path = f"/{self.proxy_path}"
        headers = self.create_request_headers(
            signature_path=signature_path,
            integration_id=self.org_integration.id,
            base_url="https://foobar.example.com/api",
        )

        mock_response = Mock(spec=Response)
        mock_response.content = str({"some": "data"}).encode("utf-8")
        mock_response.status_code = 400
        mock_response.reason = "Bad Request"
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

        prepared_request = mock_client.request.call_args.kwargs["prepared_request"]
        assert prepared_request.url == "https://foobar.example.com/api/chat.postMessage"
        assert prepared_request.headers == {
            "Cookie": "",
            "Content-Type": "application/octet-stream",
        }

        assert proxy_response.content == mock_response.content
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
        headers = self.create_request_headers(
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
            failure_type=IntegrationProxyFailureMetricType.INVALID_REQUEST,
            count=1,
            mock_metrics=mock_metrics,
        )

        # SLO assertions
        # SHOULD_PROXY (failure)
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record_event, EventLifecycleOutcome.FAILURE, 1)

    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test__validate_sender(self) -> None:
        # Missing header data
        header_kwargs = SiloHttpHeaders()
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_sender(request)

        # Bad header data
        header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_SIGNATURE="data",
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION="present",
        )
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_sender(request)

        # Success
        assert self.endpoint_cls._validate_sender(self.valid_request)

    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test__validate_request(self):
        request = self.factory.get(self.path)
        assert not self.endpoint_cls._validate_request(request)

    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test__validate_header_data(self):
        self.org_integration.update(status=ObjectStatus.DISABLED)
        header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(self.org_integration.id),
        )
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_request(request)

    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test__validate_organization_integration(self):
        header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION="None",
        )
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_request(request)

    @patch.object(metrics, "incr")
    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test__invalid_integration(self, mock_metrics):
        self.org_integration.update(status=ObjectStatus.ACTIVE)
        self.integration.update(status=ObjectStatus.DISABLED)
        header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(self.org_integration.id),
        )
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_request(request)
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.INVALID_INTEGRATION,
            count=1,
            mock_metrics=mock_metrics,
        )

    @patch.object(metrics, "incr")
    @patch.object(Integration, "get_installation")
    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test_invalid_client(self, mock_get_installation, mock_metrics):
        header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(self.org_integration.id),
        )
        self.integration.update(status=ObjectStatus.ACTIVE)
        mock_get_installation().get_client = MagicMock(return_value=ApiClient())
        request = self.factory.get(self.path, **header_kwargs)
        assert not self.endpoint_cls._validate_request(request)
        self.assert_failure_metric_count(
            failure_type=IntegrationProxyFailureMetricType.INVALID_CLIENT,
            count=1,
            mock_metrics=mock_metrics,
        )

    @patch.object(Integration, "get_installation")
    @override_settings(SENTRY_SUBNET_SECRET=secret, SILO_MODE=SiloMode.CONTROL)
    def test_successful_response(self, mock_get_installation):
        header_kwargs = SiloHttpHeaders(
            HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(self.org_integration.id),
        )
        mock_get_installation().get_client = MagicMock(
            return_value=IntegrationProxyClient(org_integration_id=self.org_integration.id)
        )
        request = self.factory.get(self.path, **header_kwargs)
        assert self.endpoint_cls._validate_request(request)

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
        headers = self.create_request_headers(
            signature_path=signature_path, integration_id=self.org_integration.id
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
        headers = self.create_request_headers(
            signature_path=signature_path, integration_id=self.org_integration.id
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
        headers = self.create_request_headers(
            signature_path=signature_path, integration_id=self.org_integration.id
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
        headers = self.create_request_headers(
            signature_path=signature_path, integration_id=self.org_integration.id
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

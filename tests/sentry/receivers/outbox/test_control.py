from hashlib import sha1
from typing import Type
from unittest import mock
from unittest.mock import patch

import responses
from django.test import RequestFactory, override_settings
from pytest import raises
from requests.exceptions import ConnectionError, Timeout
from rest_framework import status

from sentry.exceptions import RestrictedIPAddress
from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import ControlOutbox, WebhookProviderIdentifier
from sentry.receivers.outbox.control import (
    process_api_application_updates,
    process_async_webhooks,
    process_integration_updates,
)
from sentry.shared_integrations.exceptions import (
    ApiConnectionResetError,
    ApiError,
    ApiHostError,
    ApiTimeoutError,
)
from sentry.silo.base import SiloMode
from sentry.silo.client import CACHE_TIMEOUT, REQUEST_ATTEMPTS_LIMIT, SiloClientError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

_TEST_REGION = Region("eu", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT)


@control_silo_test(regions=[_TEST_REGION])
class ProcessControlOutboxTest(TestCase):
    identifier = 1

    def generate_outbox(self):
        request = RequestFactory().post(
            "/extensions/github/webhook/",
            data={"installation": {"id": "github:1"}},
            content_type="application/json",
            HTTP_X_GITHUB_EMOTICON=">:^]",
        )
        [outbox] = ControlOutbox.for_webhook_update(
            webhook_identifier=WebhookProviderIdentifier.GITHUB,
            region_names=[_TEST_REGION.name],
            request=request,
        )
        outbox.save()
        outbox.refresh_from_db()

        prefix_hash = sha1(
            f"{outbox.shard_identifier}{outbox.object_identifier}".encode()
        ).hexdigest()
        hash = sha1(
            f"{prefix_hash}{_TEST_REGION.name}POST/extensions/github/webhook/".encode()
        ).hexdigest()
        cache_key = f"region_silo_client:request_attempts:{hash}"

        return request, outbox, cache_key

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_integration_updatess(self, mock_maybe_process):
        process_integration_updates(
            object_identifier=self.identifier, region_name=_TEST_REGION.name
        )
        mock_maybe_process.assert_called_with(
            Integration, self.identifier, region_name=_TEST_REGION.name
        )

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_api_application_updates(self, mock_maybe_process):
        process_api_application_updates(
            object_identifier=self.identifier, region_name=_TEST_REGION.name
        )
        mock_maybe_process.assert_called_with(
            ApiApplication, self.identifier, region_name=_TEST_REGION.name
        )

    @responses.activate
    def test_process_async_webhooks_region_silo(self):
        request, outbox, _ = self.generate_outbox()

        mock_response = responses.add(
            request.method,
            f"{_TEST_REGION.address}{request.path}",
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
        with override_settings(SILO_MODE=SiloMode.REGION), mock.patch(
            "sentry_sdk.capture_exception"
        ) as capture_exception:
            process_async_webhooks(
                payload=outbox.payload,
                region_name=_TEST_REGION.name,
                shard_identifier=outbox.shard_identifier,
                object_identifier=outbox.object_identifier,
            )
            assert len(responses.calls) == 0
            assert mock_response.call_count == 0
            assert capture_exception.call_count == 1
            exception = capture_exception.call_args.args[0]
            assert exception.args[0] == "Called process_async_webhooks in REGION mode"

    @responses.activate
    @mock.patch("sentry.silo.client.cache")
    def test_process_async_webhooks_success(self, mock_cache):
        parent_mock = mock.Mock()
        parent_mock.attach_mock(mock_cache.get, "cache_get")
        parent_mock.attach_mock(mock_cache.set, "cache_set")
        parent_mock.attach_mock(mock_cache.delete, "cache_delete")

        request, outbox, cache_key = self.generate_outbox()

        mock_response = responses.add(
            request.method,
            f"{_TEST_REGION.address}{request.path}",
            status=status.HTTP_200_OK,
        )
        process_async_webhooks(
            payload=outbox.payload,
            region_name=_TEST_REGION.name,
            shard_identifier=outbox.shard_identifier,
            object_identifier=outbox.object_identifier,
        )

        assert mock_response.call_count == 1

        assert mock_cache.get.call_count == 0
        assert mock_cache.set.call_count == 0
        assert mock_cache.delete.call_count == 1

        # Assert order of cache method calls
        expected_calls = [
            mock.call.cache_delete(cache_key),
        ]
        assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @mock.patch("sentry.silo.client.cache")
    def test_process_async_webhooks_server_failure(self, mock_cache):
        mock_cache.get.return_value = None
        parent_mock = mock.Mock()
        parent_mock.attach_mock(mock_cache.get, "cache_get")
        parent_mock.attach_mock(mock_cache.set, "cache_set")
        parent_mock.attach_mock(mock_cache.delete, "cache_delete")

        request, outbox, cache_key = self.generate_outbox()

        mock_response = responses.add(
            request.method,
            f"{_TEST_REGION.address}{request.path}",
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )

        with raises(ApiError):
            process_async_webhooks(
                payload=outbox.payload,
                region_name=_TEST_REGION.name,
                shard_identifier=outbox.shard_identifier,
                object_identifier=outbox.object_identifier,
            )
        assert mock_response.call_count == 1

        assert mock_cache.get.call_count == 1
        assert mock_cache.set.call_count == 1
        assert mock_cache.delete.call_count == 0

        # Assert order of cache method calls
        expected_calls = [
            mock.call.cache_get(cache_key),
            mock.call.cache_set(cache_key, 1, timeout=CACHE_TIMEOUT),
        ]
        assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @mock.patch("sentry.silo.client.cache")
    def test_process_async_webhooks_retry_limit_reached(self, mock_cache):
        request, outbox, cache_key = self.generate_outbox()

        responses.add(
            request.method,
            f"{_TEST_REGION.address}{request.path}",
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
        num_of_request_attempts = 0

        while True:
            if num_of_request_attempts > REQUEST_ATTEMPTS_LIMIT:
                assert False, "Request attempts limit not captured"

            mock_cache.reset_mock()
            responses.calls.reset()

            if num_of_request_attempts == 0:
                mock_cache.get.return_value = None
            else:
                mock_cache.get.return_value = num_of_request_attempts

            parent_mock = mock.Mock()
            parent_mock.attach_mock(mock_cache.get, "cache_get")
            parent_mock.attach_mock(mock_cache.set, "cache_set")
            parent_mock.attach_mock(mock_cache.delete, "cache_delete")

            if num_of_request_attempts == REQUEST_ATTEMPTS_LIMIT:
                with mock.patch("sentry_sdk.capture_exception") as capture_exception:
                    process_async_webhooks(
                        payload=outbox.payload,
                        region_name=_TEST_REGION.name,
                        shard_identifier=outbox.shard_identifier,
                        object_identifier=outbox.object_identifier,
                    )
                    assert len(responses.calls) == 1

                    assert capture_exception.call_count == 1
                    exception = capture_exception.call_args.args[0]
                    assert isinstance(exception, SiloClientError)
                    assert (
                        exception.args[0]
                        == f"Request attempts limit reached for: {request.method} {request.path}"
                    )

                assert mock_cache.get.call_count == 1
                assert mock_cache.set.call_count == 0
                assert mock_cache.delete.call_count == 1

                # Assert order of cache method calls
                expected_calls = [
                    mock.call.cache_get(cache_key),
                    mock.call.cache_delete(cache_key),
                ]
                assert parent_mock.mock_calls == expected_calls
                return
            else:
                with raises(ApiError):
                    process_async_webhooks(
                        payload=outbox.payload,
                        region_name=_TEST_REGION.name,
                        shard_identifier=outbox.shard_identifier,
                        object_identifier=outbox.object_identifier,
                    )
                assert len(responses.calls) == 1
                resp = responses.calls[0].response
                assert resp.status_code == status.HTTP_504_GATEWAY_TIMEOUT

                num_of_request_attempts += 1

                assert mock_cache.get.call_count == 1
                assert mock_cache.set.call_count == 1
                assert mock_cache.delete.call_count == 0

                # Assert order of cache method calls
                expected_calls = [
                    mock.call.cache_get(cache_key),
                    mock.call.cache_set(cache_key, num_of_request_attempts, timeout=CACHE_TIMEOUT),
                ]
                assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @mock.patch("sentry.silo.client.cache")
    def test_process_async_webhooks_retry_within_limit(self, mock_cache):
        request, outbox, cache_key = self.generate_outbox()

        responses.add(
            request.method,
            f"{_TEST_REGION.address}{request.path}",
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
        num_of_request_attempts = 0

        while True:
            mock_cache.reset_mock()
            responses.calls.reset()

            if num_of_request_attempts == (REQUEST_ATTEMPTS_LIMIT - 1):
                responses.replace(
                    request.method,
                    f"{_TEST_REGION.address}{request.path}",
                    status=200,
                    json={"ok": True},
                )

            if num_of_request_attempts == 0:
                mock_cache.get.return_value = None
            else:
                mock_cache.get.return_value = num_of_request_attempts

            parent_mock = mock.Mock()
            parent_mock.attach_mock(mock_cache.get, "cache_get")
            parent_mock.attach_mock(mock_cache.set, "cache_set")
            parent_mock.attach_mock(mock_cache.delete, "cache_delete")

            if num_of_request_attempts == (REQUEST_ATTEMPTS_LIMIT - 1):
                with mock.patch("sentry_sdk.capture_exception") as capture_exception:
                    process_async_webhooks(
                        payload=outbox.payload,
                        region_name=_TEST_REGION.name,
                        shard_identifier=outbox.shard_identifier,
                        object_identifier=outbox.object_identifier,
                    )
                    assert len(responses.calls) == 1

                    assert capture_exception.call_count == 0

                assert mock_cache.get.call_count == 0
                assert mock_cache.set.call_count == 0
                assert mock_cache.delete.call_count == 1

                # Assert order of cache method calls
                expected_calls = [
                    mock.call.cache_delete(cache_key),
                ]
                assert parent_mock.mock_calls == expected_calls
                return
            else:
                with raises(ApiError):
                    process_async_webhooks(
                        payload=outbox.payload,
                        region_name=_TEST_REGION.name,
                        shard_identifier=outbox.shard_identifier,
                        object_identifier=outbox.object_identifier,
                    )
                assert len(responses.calls) == 1
                resp = responses.calls[0].response
                assert resp.status_code == status.HTTP_504_GATEWAY_TIMEOUT

                num_of_request_attempts += 1

                assert mock_cache.get.call_count == 1
                assert mock_cache.set.call_count == 1
                assert mock_cache.delete.call_count == 0

                # Assert order of cache method calls
                expected_calls = [
                    mock.call.cache_get(cache_key),
                    mock.call.cache_set(cache_key, num_of_request_attempts, timeout=CACHE_TIMEOUT),
                ]
                assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @patch("sentry.silo.client.RegionSiloClient", side_effect=SiloClientError)
    def test_process_async_webhooks_region_silo_client_exception(self, mock_region_silo_client):
        request, outbox, _ = self.generate_outbox()

        mock_response = responses.add(
            request.method,
            f"{_TEST_REGION.address}{request.path}",
            status=status.HTTP_400_BAD_REQUEST,
        )
        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            process_async_webhooks(
                payload=outbox.payload,
                region_name=_TEST_REGION.name,
                shard_identifier=outbox.shard_identifier,
                object_identifier=outbox.object_identifier,
            )
            assert mock_response.call_count == 0
            assert capture_exception.call_count == 1
            exception = capture_exception.call_args.args[0]
            assert isinstance(exception, SiloClientError)

    @responses.activate
    @mock.patch("sentry.silo.client.cache")
    def test_process_async_webhooks_api_host_error(self, mock_cache):
        request, outbox, cache_key = self.generate_outbox()

        api_host_errors = [RestrictedIPAddress, ConnectionError, ApiHostError]

        for api_host_error in api_host_errors:
            mock_cache.reset_mock()
            responses.calls.reset()
            responses.add(
                request.method,
                f"{_TEST_REGION.address}{request.path}",
                body=api_host_error("oh no"),
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )

            mock_cache.get.return_value = None
            parent_mock = mock.Mock()
            parent_mock.attach_mock(mock_cache.get, "cache_get")
            parent_mock.attach_mock(mock_cache.set, "cache_set")
            parent_mock.attach_mock(mock_cache.delete, "cache_delete")

            with mock.patch("sentry_sdk.capture_exception") as capture_exception:
                # Does not raise on ApiHostError exceptions
                process_async_webhooks(
                    payload=outbox.payload,
                    region_name=_TEST_REGION.name,
                    shard_identifier=outbox.shard_identifier,
                    object_identifier=outbox.object_identifier,
                )

                assert capture_exception.call_count == 1
                exception = capture_exception.call_args.args[0]

                if api_host_error == RestrictedIPAddress:
                    assert isinstance(exception, SiloClientError)
                    assert exception.args[0] == "Region silo is IP address restricted"
                    assert isinstance(exception.__cause__, ApiHostError)
                    assert isinstance(exception.__cause__.__cause__, RestrictedIPAddress)
                else:
                    assert isinstance(exception, ApiHostError)
                    if api_host_error != ApiHostError:
                        assert isinstance(exception.__cause__, api_host_error)

                assert mock_cache.get.call_count == 1
                assert mock_cache.set.call_count == 1
                assert mock_cache.delete.call_count == 0

                # Assert order of cache method calls
                expected_calls = [
                    mock.call.cache_get(cache_key),
                    mock.call.cache_set(cache_key, 1, timeout=CACHE_TIMEOUT),
                ]
                assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @mock.patch("sentry.silo.client.cache")
    def test_process_async_webhooks_connection_errors(self, mock_cache):
        request, outbox, cache_key = self.generate_outbox()

        api_host_errors = [ApiTimeoutError, Timeout, ApiConnectionResetError]
        for api_host_error in api_host_errors:
            mock_cache.reset_mock()
            responses.calls.reset()
            responses.add(
                request.method,
                f"{_TEST_REGION.address}{request.path}",
                body=api_host_error("oh no"),
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )

            mock_cache.get.return_value = None
            parent_mock = mock.Mock()
            parent_mock.attach_mock(mock_cache.get, "cache_get")
            parent_mock.attach_mock(mock_cache.set, "cache_set")
            parent_mock.attach_mock(mock_cache.delete, "cache_delete")

            expected_exception: Type[Exception] = ApiTimeoutError
            if api_host_error == ApiConnectionResetError:
                expected_exception = ApiConnectionResetError

            with raises(expected_exception) as exception_info:
                # Raises on timeout errors
                process_async_webhooks(
                    payload=outbox.payload,
                    region_name=_TEST_REGION.name,
                    shard_identifier=outbox.shard_identifier,
                    object_identifier=outbox.object_identifier,
                )

            if expected_exception == ApiConnectionResetError:
                assert isinstance(exception_info.value, ApiConnectionResetError)
            else:
                assert isinstance(exception_info.value, ApiTimeoutError)

            assert mock_cache.get.call_count == 1
            assert mock_cache.set.call_count == 1
            assert mock_cache.delete.call_count == 0

            # Assert order of cache method calls
            expected_calls = [
                mock.call.cache_get(cache_key),
                mock.call.cache_set(cache_key, 1, timeout=CACHE_TIMEOUT),
            ]
            assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @mock.patch("sentry.silo.client.cache")
    def test_process_async_webhooks_4xx_error(self, mock_cache):
        parent_mock = mock.Mock()
        parent_mock.attach_mock(mock_cache.get, "cache_get")
        parent_mock.attach_mock(mock_cache.set, "cache_set")
        parent_mock.attach_mock(mock_cache.delete, "cache_delete")

        request, outbox, cache_key = self.generate_outbox()

        mock_response = responses.add(
            request.method,
            f"{_TEST_REGION.address}{request.path}",
            status=status.HTTP_400_BAD_REQUEST,
            json={"error": "bad request"},
        )
        with mock.patch("sentry_sdk.capture_exception") as capture_exception:
            process_async_webhooks(
                payload=outbox.payload,
                region_name=_TEST_REGION.name,
                shard_identifier=outbox.shard_identifier,
                object_identifier=outbox.object_identifier,
            )
            assert len(responses.calls) == 1
            assert mock_response.call_count == 1
            assert capture_exception.call_count == 0

            assert mock_cache.get.call_count == 1
            assert mock_cache.set.call_count == 1
            assert mock_cache.delete.call_count == 0

            # Assert order of cache method calls
            expected_calls = [
                mock.call.cache_get(cache_key),
                mock.call.cache_set(cache_key, 1, timeout=CACHE_TIMEOUT),
            ]
            assert parent_mock.mock_calls == expected_calls

    @responses.activate
    @mock.patch("sentry.silo.client.cache")
    def test_process_async_webhooks_5xx_error(self, mock_cache):
        parent_mock = mock.Mock()
        parent_mock.attach_mock(mock_cache.get, "cache_get")
        parent_mock.attach_mock(mock_cache.set, "cache_set")
        parent_mock.attach_mock(mock_cache.delete, "cache_delete")

        request, outbox, cache_key = self.generate_outbox()

        mock_response = responses.add(
            request.method,
            f"{_TEST_REGION.address}{request.path}",
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
            json={"error": "server exploded"},
        )
        with mock.patch("sentry_sdk.capture_exception") as capture_exception, raises(
            ApiError
        ) as exception_info:
            process_async_webhooks(
                payload=outbox.payload,
                region_name=_TEST_REGION.name,
                shard_identifier=outbox.shard_identifier,
                object_identifier=outbox.object_identifier,
            )
            assert len(responses.calls) == 1
            assert mock_response.call_count == 1

            assert capture_exception.call_count == 0
            exception = exception_info.value
            assert isinstance(exception, ApiError)

            assert mock_cache.get.call_count == 1
            assert mock_cache.set.call_count == 1
            assert mock_cache.delete.call_count == 0

            # Assert order of cache method calls
            expected_calls = [
                mock.call.cache_get(cache_key),
                mock.call.cache_set(cache_key, 1, timeout=CACHE_TIMEOUT),
            ]
            assert parent_mock.mock_calls == expected_calls

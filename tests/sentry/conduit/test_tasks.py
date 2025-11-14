from typing import int
import datetime
import re
from unittest.mock import patch
from uuid import uuid4

import jwt as pyjwt
import pytest
import responses
from django.test import override_settings
from requests.exceptions import RequestException
from sentry_protos.conduit.v1alpha.publish_pb2 import Phase, PublishRequest

from sentry.conduit.tasks import (
    NUM_DELTAS,
    PUBLISH_REQUEST_MAX_RETRIES,
    generate_jwt,
    get_timestamp,
    publish_data,
    stream_demo_data,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class GenerateJWTTest(TestCase):
    @override_settings(
        CONDUIT_PUBLISH_SECRET="test-secret",
        CONDUIT_PUBLISH_JWT_ISSUER="test-issuer",
        CONDUIT_PUBLISH_JWT_AUDIENCE="test-audience",
    )
    def test_generate_jwt_uses_settings(self):
        """Test that generate_jwt uses settings when parameters are not provided."""
        token = generate_jwt(subject="test-subject")

        claims = pyjwt.decode(token, options={"verify_signature": False})

        assert claims["sub"] == "test-subject"
        assert claims["iss"] == "test-issuer"
        assert claims["aud"] == "test-audience"
        assert "exp" in claims

    def test_generate_jwt_uses_provided_parameters(self):
        """Test that generate_jwt uses parameters when provided."""
        token = generate_jwt(
            subject="test-subject",
            issuer="custom-issuer",
            audience="custom-audience",
            secret="custom-secret",
        )

        claims = pyjwt.decode(token, options={"verify_signature": False})

        assert claims["sub"] == "test-subject"
        assert claims["iss"] == "custom-issuer"
        assert claims["aud"] == "custom-audience"
        assert "exp" in claims

    def test_generate_jwt_raises_when_secret_missing(self):
        """Test that generate_jwt raises ValueError when secret is not configured."""
        with pytest.raises(ValueError) as context:
            generate_jwt(subject="test-subject")

        assert "CONDUIT_PUBLISH_SECRET not configured" in str(context.value)


class GetTimestampTest(TestCase):
    @freeze_time("2025-01-01T12:00:00Z")
    def test_get_timestamp_uses_current_time(self):
        """Test that get_timestamp generates a valid timestamp."""
        timestamp = get_timestamp()

        dt = timestamp.ToDatetime()
        expected = datetime.datetime(2025, 1, 1, 12, 0, 0)
        assert dt == expected

    def test_get_timestamp_uses_provided_datetime(self):
        """Test that get_timestamp uses provided datetime."""
        custom_dt = datetime.datetime(2024, 1, 1, 12, 0, 0)
        timestamp = get_timestamp(custom_dt)

        dt = timestamp.ToDatetime()
        assert dt == custom_dt


class PublishDataTest(TestCase):
    @responses.activate
    @override_settings(
        CONDUIT_PUBLISH_SECRET="test-secret",
        CONDUIT_PUBLISH_JWT_ISSUER="sentry",
        CONDUIT_PUBLISH_JWT_AUDIENCE="conduit",
        CONDUIT_PUBLISH_URL="http://localhost:9093",
    )
    def test_publish_data_success(self):
        """Test successful publish request."""
        org_id = 123
        channel_id = str(uuid4())
        token = generate_jwt(subject="test")

        publish_request = PublishRequest(
            channel_id=channel_id,
            message_id=str(uuid4()),
            sequence=0,
            client_timestamp=get_timestamp(),
            phase=Phase.PHASE_START,
        )

        responses.add(
            responses.POST,
            f"http://localhost:9093/publish/{org_id}/{channel_id}",
            status=200,
        )

        response = publish_data(
            org_id=org_id,
            publish_request=publish_request,
            token=token,
            publish_url="http://localhost:9093",
        )

        assert response.status_code == 200
        assert len(responses.calls) == 1

        request = responses.calls[0].request
        assert request.headers["Authorization"] == f"Bearer {token}"
        assert request.headers["Content-Type"] == "application/x-protobuf"

    @responses.activate
    @override_settings(
        CONDUIT_PUBLISH_SECRET="test-secret",
        CONDUIT_PUBLISH_JWT_ISSUER="sentry",
        CONDUIT_PUBLISH_JWT_AUDIENCE="conduit",
        CONDUIT_PUBLISH_URL="http://localhost:9093",
    )
    def test_publish_data_retry_on_failure(self):
        """Test that publish_data retries on RequestException."""
        org_id = 123
        channel_id = str(uuid4())
        token = generate_jwt(subject="test")

        publish_request = PublishRequest(
            channel_id=channel_id,
            message_id=str(uuid4()),
            sequence=0,
            client_timestamp=get_timestamp(),
            phase=Phase.PHASE_START,
        )

        # Fails twice, then succeeds
        responses.add(
            responses.POST,
            f"http://localhost:9093/publish/{org_id}/{channel_id}",
            status=500,
        )
        responses.add(
            responses.POST,
            f"http://localhost:9093/publish/{org_id}/{channel_id}",
            status=500,
        )
        responses.add(
            responses.POST,
            f"http://localhost:9093/publish/{org_id}/{channel_id}",
            status=200,
        )

        response = publish_data(
            org_id=org_id,
            publish_request=publish_request,
            token=token,
            publish_url="http://localhost:9093",
        )

        assert response.status_code == 200
        assert len(responses.calls) == 3

    @responses.activate
    @override_settings(
        CONDUIT_PUBLISH_SECRET="test-secret",
        CONDUIT_PUBLISH_JWT_ISSUER="sentry",
        CONDUIT_PUBLISH_JWT_AUDIENCE="conduit",
        CONDUIT_PUBLISH_URL="http://localhost:9093",
    )
    def test_publish_data_max_retries_exceeded(self):
        """Test that publish_data raises after max retries."""
        org_id = 123
        channel_id = str(uuid4())
        token = generate_jwt(subject="test")

        publish_request = PublishRequest(
            channel_id=channel_id,
            message_id=str(uuid4()),
            sequence=0,
            client_timestamp=get_timestamp(),
            phase=Phase.PHASE_START,
        )

        for _ in range(PUBLISH_REQUEST_MAX_RETRIES):
            responses.add(
                responses.POST,
                f"http://localhost:9093/publish/{org_id}/{channel_id}",
                status=500,
            )

        with pytest.raises(RequestException):
            publish_data(
                org_id=org_id,
                publish_request=publish_request,
                token=token,
            )

        assert len(responses.calls) == PUBLISH_REQUEST_MAX_RETRIES

    @responses.activate
    @override_settings(
        CONDUIT_PUBLISH_SECRET="test-secret",
        CONDUIT_PUBLISH_JWT_ISSUER="sentry",
        CONDUIT_PUBLISH_JWT_AUDIENCE="conduit",
        CONDUIT_PUBLISH_URL="http://localhost:9093",
    )
    def test_publish_data_uses_custom_url(self):
        """Test that publish_data uses provided publish_url."""
        org_id = 123
        channel_id = str(uuid4())
        token = generate_jwt(subject="test")
        custom_url = "http://custom.example.com"

        publish_request = PublishRequest(
            channel_id=channel_id,
            message_id=str(uuid4()),
            sequence=0,
            client_timestamp=get_timestamp(),
            phase=Phase.PHASE_START,
        )

        responses.add(
            responses.POST,
            f"{custom_url}/publish/{org_id}/{channel_id}",
            status=200,
        )

        response = publish_data(
            org_id=org_id,
            publish_request=publish_request,
            token=token,
            publish_url=custom_url,
        )

        assert response.status_code == 200
        assert len(responses.calls) == 1


class StreamDemoDataTest(TestCase):
    @responses.activate
    @override_settings(
        CONDUIT_PUBLISH_SECRET="test-secret",
        CONDUIT_PUBLISH_JWT_ISSUER="sentry",
        CONDUIT_PUBLISH_JWT_AUDIENCE="conduit",
        CONDUIT_PUBLISH_URL="http://localhost:9093",
    )
    @patch("sentry.conduit.tasks.time.sleep")
    def test_stream_demo_data_sends_all_phases(self, mock_sleep):
        """Test that stream_demo_data sends START, DELTA, and END phases."""
        org_id = 123
        channel_id = str(uuid4())

        responses.add(
            responses.POST,
            re.compile(r"http://localhost:9093/publish/\d+/.+"),
            status=200,
        )

        stream_demo_data(org_id=org_id, channel_id=channel_id)

        assert len(responses.calls) == NUM_DELTAS + 2
        assert mock_sleep.call_count == NUM_DELTAS

    @responses.activate
    @override_settings(
        CONDUIT_PUBLISH_SECRET="test-secret",
        CONDUIT_PUBLISH_JWT_ISSUER="sentry",
        CONDUIT_PUBLISH_JWT_AUDIENCE="conduit",
        CONDUIT_PUBLISH_URL="http://localhost:9093",
    )
    @patch("sentry.conduit.tasks.time.sleep")
    def test_stream_demo_data_stops_on_exhausted_retries(self, mock_sleep):
        """Test that stream_demo_data stops streaming when a publish fails after max retries."""
        org_id = 123
        channel_id = str(uuid4())

        # Fail after 10 successful requests
        for _ in range(10):
            responses.add(
                responses.POST,
                re.compile(r"http://localhost:9093/publish/\d+/.+"),
                status=200,
            )

        for _ in range(PUBLISH_REQUEST_MAX_RETRIES):
            responses.add(
                responses.POST,
                re.compile(r"http://localhost:9093/publish/\d+/.+"),
                status=500,
            )

        with pytest.raises(RequestException):
            stream_demo_data(org_id=org_id, channel_id=channel_id)

        assert len(responses.calls) == 10 + PUBLISH_REQUEST_MAX_RETRIES

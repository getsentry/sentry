from typing import int
import base64
import time
from unittest.mock import patch

import jwt as pyjwt
import pytest

from sentry.conduit.auth import generate_channel_id, generate_conduit_token, get_conduit_credentials
from tests.sentry.utils.test_jwt import RS256_KEY, RS256_PUB_KEY

RS256_KEY_B64 = base64.b64encode(RS256_KEY.encode()).decode()


def test_generate_channel_id_is_valid_uuid():
    """Should generate a valid uuid."""
    channel_id = generate_channel_id()

    # UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    assert isinstance(channel_id, str)
    assert len(channel_id) == 36  # Length of UUID
    assert channel_id.count("-") == 4


def test_generate_channel_id_is_unique():
    """Should generate unique channel_ids."""
    assert generate_channel_id() != generate_channel_id()


def test_generate_conduit_token_is_valid_jwt():
    """Should generate a valid JWT token with RS256."""
    org_id = 123
    channel_id = "ad342057-d66b-4ed4-ab01-3415dd2cb1ce"

    token = generate_conduit_token(
        org_id,
        channel_id,
        issuer="sentry",
        audience="conduit",
        conduit_private_key=RS256_KEY_B64,
    )

    assert isinstance(token, str)
    assert token.count(".") == 2

    claims = pyjwt.decode(token, RS256_PUB_KEY, algorithms=["RS256"], audience="conduit")

    assert claims["channel_id"] == channel_id
    assert claims["org_id"] == org_id
    assert claims["iss"] == "sentry"
    assert claims["aud"] == "conduit"
    assert "iat" in claims
    assert "exp" in claims


def test_generate_conduit_token_has_expiration():
    """Token should expire in 10 minutes."""
    org_id = 123
    channel_id = "ad342057-d66b-4ed4-ab01-3415dd2cb1ce"

    before_time = int(time.time())
    token = generate_conduit_token(
        org_id,
        channel_id,
        issuer="sentry",
        audience="conduit",
        conduit_private_key=RS256_KEY_B64,
    )
    after_time = int(time.time())

    claims = pyjwt.decode(
        token,
        RS256_PUB_KEY,
        algorithms=["RS256"],
        audience="conduit",
        options={"verify_exp": False},
    )

    exp_time = claims["exp"]
    iat_time = claims["iat"]

    assert iat_time >= before_time
    assert iat_time <= after_time
    assert exp_time == iat_time + 600


def test_generate_conduit_token_uses_settings():
    """Should use settings when parameters are not provided."""
    org_id = 123
    channel_id = "ad342057-d66b-4ed4-ab01-3415dd2cb1ce"

    with patch("sentry.conduit.auth.settings") as mock_settings:
        mock_settings.CONDUIT_GATEWAY_PRIVATE_KEY = RS256_KEY_B64
        mock_settings.CONDUIT_GATEWAY_JWT_ISSUER = "test-issuer"
        mock_settings.CONDUIT_GATEWAY_JWT_AUDIENCE = "test-audience"

        token = generate_conduit_token(
            org_id,
            channel_id,
        )

        claims = pyjwt.decode(
            token,
            RS256_PUB_KEY,
            algorithms=["RS256"],
            audience="test-audience",
            options={"verify_exp": False},
        )

        assert claims["iss"] == "test-issuer"
        assert claims["aud"] == "test-audience"


def test_generate_conduit_token_raises_when_missing():
    """Should raise an error if the private key is not configured."""
    org_id = 123
    channel_id = "ad342057-d66b-4ed4-ab01-3415dd2cb1ce"
    with pytest.raises(ValueError, match="CONDUIT_GATEWAY_PRIVATE_KEY not configured"):
        generate_conduit_token(
            org_id,
            channel_id,
        )


def test_generate_conduit_token_raises_when_invalid_base64():
    """Should raise an error if the private key isn't valid base64."""
    org_id = 123
    channel_id = "ad342057-d66b-4ed4-ab01-3415dd2cb1ce"
    with pytest.raises(ValueError, match="CONDUIT_GATEWAY_PRIVATE_KEY is not valid base64"):
        generate_conduit_token(
            org_id,
            channel_id,
            conduit_private_key=RS256_KEY,
        )


def test_generate_conduit_token_raises_when_invalid_utf8():
    """Should raise an error if the private key isn't valid UTF-8 after base64 decode."""
    org_id = 123
    channel_id = "ad342057-d66b-4ed4-ab01-3415dd2cb1ce"
    invalid_utf8_base64 = base64.b64encode(b"\xff\xfe\xfd").decode()
    with pytest.raises(ValueError, match="CONDUIT_GATEWAY_PRIVATE_KEY is not valid base64"):
        generate_conduit_token(
            org_id,
            channel_id,
            conduit_private_key=invalid_utf8_base64,
        )


def test_get_conduit_credentials_returns_all_credentials():
    """Should return a url, token, and channel_id."""
    gateway_url = "https://conduit.example.com"
    with patch("sentry.conduit.auth.settings") as mock_settings:
        mock_settings.CONDUIT_GATEWAY_PRIVATE_KEY = RS256_KEY_B64
        mock_settings.CONDUIT_GATEWAY_JWT_ISSUER = "sentry"
        mock_settings.CONDUIT_GATEWAY_JWT_AUDIENCE = "conduit"
        mock_settings.CONDUIT_GATEWAY_URL = gateway_url

        org_id = 123
        result = get_conduit_credentials(org_id)

        assert isinstance(result.token, str)
        assert isinstance(result.channel_id, str)
        assert isinstance(result.url, str)

        assert str(org_id) in result.url
        assert result.url == f"{gateway_url}/events/{org_id}"


def test_get_conduit_credentials_uses_custom_url():
    """Should use provided gateway_url instead of settings."""
    gateway_url = "https://custom.conduit.io"
    with patch("sentry.conduit.auth.settings") as mock_settings:
        mock_settings.CONDUIT_GATEWAY_PRIVATE_KEY = RS256_KEY_B64
        mock_settings.CONDUIT_GATEWAY_JWT_ISSUER = "sentry"
        mock_settings.CONDUIT_GATEWAY_JWT_AUDIENCE = "conduit"

        org_id = 123
        result = get_conduit_credentials(org_id, gateway_url)

        assert isinstance(result.token, str)
        assert isinstance(result.channel_id, str)
        assert isinstance(result.url, str)

        assert str(org_id) in result.url
        assert result.url == f"{gateway_url}/events/{org_id}"


def test_get_conduit_credentials_token_is_valid():
    """Generated token should be decodable with correct claims."""
    gateway_url = "https://conduit.example.com"
    with patch("sentry.conduit.auth.settings") as mock_settings:
        mock_settings.CONDUIT_GATEWAY_PRIVATE_KEY = RS256_KEY_B64
        mock_settings.CONDUIT_GATEWAY_JWT_ISSUER = "sentry"
        mock_settings.CONDUIT_GATEWAY_JWT_AUDIENCE = "conduit"
        mock_settings.CONDUIT_GATEWAY_URL = gateway_url

        org_id = 123
        result = get_conduit_credentials(org_id)

        claims = pyjwt.decode(
            result.token,
            RS256_PUB_KEY,
            algorithms=["RS256"],
            audience="conduit",
            options={"verify_exp": False},
        )

        assert claims["org_id"] == org_id
        assert claims["channel_id"] == result.channel_id

        assert str(org_id) in result.url
        assert result.url == f"{gateway_url}/events/{org_id}"

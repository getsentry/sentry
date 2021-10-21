import jwt as pyjwt
import pytest

from sentry.testutils.helpers.jwt import RS256_KEY, RS256_PUB_KEY, RSA_JWK, RSA_PUB_JWK
from sentry.utils import json  # type: ignore
from sentry.utils import jwt as jwt_utils


@pytest.fixture  # type: ignore
def token() -> str:
    """A JWT token, signed with symmetric key."""
    headers = {
        "alg": "HS256",
        "typ": "JWT",
    }
    claims = {
        "iss": "me",
    }
    key = "secret"
    token = pyjwt.encode(claims, key, algorithm="HS256", headers=headers)
    assert isinstance(token, str)
    return token


@pytest.fixture  # type: ignore
def rsa_token() -> str:
    """A JWT token, signed with RSA key."""
    headers = {
        "alg": "RS256",
        "typ": "JWT",
    }
    claims = {
        "iss": "me",
    }
    token = pyjwt.encode(claims, RS256_KEY, algorithm="RS256", headers=headers)
    assert isinstance(token, str)
    return token


def test_peek_header(token: str) -> None:
    header = jwt_utils.peek_header(token)

    assert isinstance(header, dict)
    for key, value in header.items():
        assert isinstance(key, str)
        assert isinstance(value, str)

    assert header == {"alg": "HS256", "typ": "JWT"}


def test_peek_claims(token: str) -> None:
    claims = jwt_utils.peek_claims(token)
    assert claims == {"iss": "me"}

    for key, value in claims.items():
        assert isinstance(key, str)
        assert isinstance(value, str)


def test_decode(token: str) -> None:
    claims = jwt_utils.decode(token, "secret")
    assert claims == {"iss": "me"}

    for key, value in claims.items():
        assert isinstance(key, str)
        assert isinstance(value, str)

    claims["aud"] = "you"
    token = jwt_utils.encode(claims, "secret")

    with pytest.raises(pyjwt.exceptions.InvalidAudienceError):
        jwt_utils.decode(token, "secret")


def test_decode_pub(rsa_token: str) -> None:
    claims = jwt_utils.decode(rsa_token, RS256_PUB_KEY, algorithms=["RS256"])
    assert claims == {"iss": "me"}


def test_decode_audience() -> None:
    payload = {
        "iss": "me",
        "aud": "you",
    }
    token = jwt_utils.encode(payload, "secret")

    with pytest.raises(pyjwt.exceptions.InvalidAudienceError):
        jwt_utils.decode(token, "secret")

    claims = jwt_utils.decode(token, "secret", audience="you")
    assert claims == payload

    with pytest.raises(pyjwt.exceptions.InvalidAudienceError):
        jwt_utils.decode(token, "secret", audience="wrong")

    claims = jwt_utils.decode(token, "secret", audience=False)
    assert claims == payload


def test_encode(token: str) -> None:
    headers = {
        "alg": "HS256",
        "typ": "JWT",
    }
    claims = {
        "iss": "me",
    }
    key = "secret"

    encoded = jwt_utils.encode(claims, key, headers=headers)
    assert isinstance(encoded, str)

    assert encoded.count(".") == 2
    assert encoded == token

    decoded_claims = jwt_utils.decode(encoded, key)
    assert decoded_claims == claims


def test_encode_rs256() -> None:
    headers = {
        "alg": "RS256",
        "typ": "JWT",
    }
    claims = {
        "iss": "me",
    }
    encoded_hs256 = jwt_utils.encode(claims, "secret", headers=headers)
    encoded_rs256 = jwt_utils.encode(claims, RS256_KEY, headers=headers, algorithm="RS256")

    assert encoded_rs256.count(".") == 2
    assert encoded_rs256 != encoded_hs256


def test_authorization_header(token: str) -> None:
    header = jwt_utils.authorization_header(token)
    assert header == {"Authorization": f"Bearer {token}"}

    header = jwt_utils.authorization_header(token, scheme="JWT")
    assert header == {"Authorization": f"JWT {token}"}


def test_rsa_key_from_jwk() -> None:
    key = jwt_utils.rsa_key_from_jwk(json.dumps(RSA_JWK))
    assert key
    assert isinstance(key, str)

    # The PEM keys are not equal, and by more than just the header and footer ("BEGIN RSA
    # PRIVATE KEY" vs "BEGIN PRIVATE KEY").  There might be some more metadata in there that
    # is not relevant.  However below we assert the generated tokens are identical.
    # assert key == RS256_KEY.lstrip()

    # Ensure we can use the key to create a token
    claims = {"iss": "me"}
    token_from_jwk = jwt_utils.encode(claims, key, algorithm="RS256")
    token = jwt_utils.encode(claims, RS256_KEY, algorithm="RS256")
    assert token_from_jwk == token


def test_rsa_key_from_jwk_pubkey(rsa_token: str) -> None:
    key = jwt_utils.rsa_key_from_jwk(json.dumps(RSA_PUB_JWK))
    assert key
    assert isinstance(key, str)

    claims = jwt_utils.decode(rsa_token, key, algorithms=["RS256"])
    assert claims == {"iss": "me"}

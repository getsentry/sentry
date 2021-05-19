import jwt
import pytest

from sentry.utils import jwt as jwt_utils

RS256_KEY = """
-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----
"""


@pytest.fixture
def token():
    headers = {
        "alg": "HS256",
        "typ": "JWT",
    }
    claims = {
        "iss": "me",
    }
    key = "secret"
    encoded = jwt.encode(claims, key, algorithm="HS256", headers=headers)

    # PyJWT < 2.0 returns bytes, not strings
    token = encoded.decode("UTF-8")
    assert isinstance(token, str)

    return token


def test_peek_claims(token):
    claims = jwt_utils.peek_claims(token)
    assert claims == {"iss": "me"}

    for key, value in claims.items():
        assert isinstance(key, str)
        assert isinstance(value, str)


def test_decode(token):
    claims = jwt_utils.decode(token, "secret")
    assert claims == {"iss": "me"}

    for key, value in claims.items():
        assert isinstance(key, str)
        assert isinstance(value, str)

    claims["aud"] = "you"
    token = jwt_utils.encode(claims, "secret")

    with pytest.raises(jwt.InvalidAudience):
        jwt_utils.decode(token, "secret")

    claims = jwt_utils.decode(token, "secret", verify_aud=False)
    assert claims == {"iss": "me", "aud": "you"}


def test_encode(token):
    headers = {
        "alg": "HS256",
        "typ": "JWT",
    }
    claims = {
        "iss": "me",
    }
    key = b"secret"

    encoded = jwt_utils.encode(claims, key, headers=headers)
    assert isinstance(encoded, str)

    assert encoded.count(".") == 2
    assert encoded == token

    decoded_claims = jwt_utils.decode(encoded, key)
    assert decoded_claims == claims


def test_encode_rs256():
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


def test_authorization_header(token):
    header = jwt_utils.authorization_header(token)
    assert header == {"Authorization": f"Bearer {token}"}

    header = jwt_utils.authorization_header(token, scheme="JWT")
    assert header == {"Authorization": f"JWT {token}"}

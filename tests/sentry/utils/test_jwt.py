import jwt as pyjwt
import pytest

from sentry.utils import json
from sentry.utils import jwt as jwt_utils

RS256_KEY = """
-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----
"""

RS256_PUB_KEY = """
-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAwcYWTDju/+S7dgFLMp6V
QHbCMHTQD7RxoaTWKY8/NizzW7QX82QZWGyc2+1EpYgza82Joy3IQ78FRV5NHjZO
Ngeot+ZsnznFRokXvzdrshFCv4i+4Jeo9RJW/32T53dM3f7kYJ+n6cDouExHIg03
TpQKiB/SiAR8f6K+qa9xOCbFRv5McKvLWxHsSMOx034MQKseSokX+BtPrBrCNzPe
or92jljKlamIBvgtJQj/Vi4WvaFloXAZ+4BOZwe51ojujYWuLUHxo4khe5Yd/auV
5tKtOIBPFQRgcOOFfVc9J2BiwAk1KkraO4zd+s7GYvQeTd2pVLXUIQO9lLzoCtI/
f4e0NAUKNo1CY6UePsxs3Q+RdvxmO09mvq7E8BzqM5rKmpGc7xxuk9R1lZ6aHGe3
PIVKfYgPUBn8IIspoZjLhxxhk9BCmwKDRofHqtmVBOk7wWgwebDqEed99pPO63vs
ctlci1MwUo5OvUDQtd3ULCZr+5TKGPtM33rmDIrGgCOJvhp2jM54KvZpt9IyC2jv
wrrcnJV7/9Sipy1Ns+jKvGntcPJbUThjMQGqREFi8G4L8sYMYC5vJz4R1vHcysY3
k0hLqyfokkW5eNveba31yzprhUFlikfxHWIZipMb2CFxYN1bukMWnkRJU4ZhUoRW
NYg4Kl5rg3/rE+CVfboSGvcCAwEAAQ==
-----END PUBLIC KEY-----
"""

RSA_JWK = {
    "n": "wcYWTDju_-S7dgFLMp6VQHbCMHTQD7RxoaTWKY8_NizzW7QX82QZWGyc2-1EpYgza82Joy3IQ78FRV5NHjZONgeot-ZsnznFRokXvzdrshFCv4i-4Jeo9RJW_32T53dM3f7kYJ-n6cDouExHIg03TpQKiB_SiAR8f6K-qa9xOCbFRv5McKvLWxHsSMOx034MQKseSokX-BtPrBrCNzPeor92jljKlamIBvgtJQj_Vi4WvaFloXAZ-4BOZwe51ojujYWuLUHxo4khe5Yd_auV5tKtOIBPFQRgcOOFfVc9J2BiwAk1KkraO4zd-s7GYvQeTd2pVLXUIQO9lLzoCtI_f4e0NAUKNo1CY6UePsxs3Q-RdvxmO09mvq7E8BzqM5rKmpGc7xxuk9R1lZ6aHGe3PIVKfYgPUBn8IIspoZjLhxxhk9BCmwKDRofHqtmVBOk7wWgwebDqEed99pPO63vsctlci1MwUo5OvUDQtd3ULCZr-5TKGPtM33rmDIrGgCOJvhp2jM54KvZpt9IyC2jvwrrcnJV7_9Sipy1Ns-jKvGntcPJbUThjMQGqREFi8G4L8sYMYC5vJz4R1vHcysY3k0hLqyfokkW5eNveba31yzprhUFlikfxHWIZipMb2CFxYN1bukMWnkRJU4ZhUoRWNYg4Kl5rg3_rE-CVfboSGvc",
    "e": "AQAB",
    "d": "HhZj3_H3KkSZ1vjcdD-rbRcDkAKTS9z4x-CQYGOdrQvNva95CJHCXbh_oqZ0wj8jvNltRakWL265osvBra9A9aK6z9M3ioGt4AXpagdw8XU8qADToovp8COo3oLhNE-R3-Z0D4y6xdDuUa-GXAMxU0IpYHmQdw47RpY-hJp5Of7LIvrZY6VJLhraVXINaoln3aK0UV54Gk4jUNXW0jt7lkmkXvXqftKUDID8gYOkIf2GCmvFHAwL_MEva1AHywf4AoF_SgezPXFNgaMNhRXfcLfFrcA-h0TmtKCfWZbyJ-sPakIDv01gFV8KGKeCplrBWdXRNRYGmhm6lh2-6e87bIy0YsIisq5FlOti3EwKIkTGlIVVHwHyaZ8D0j7sO979OMu4VW8w5Um2hZlct0H4aVWdzaRuCC37SfKBFoU6bUEGppIvuyXbmeqwWlaCsobB60DCWZiTPGbW3DjME8I6efmwp9Z07vJoOA8EdvaTA6RjLl88tRXkj32tasP32Dg-RaD4tBnFyRJMYmbfa4-NZ3rkihD-jzriw0e8orimrCrYz_f84fm3yfUiDs--SF1BTBC-WVhFUGQqdrl3-JCzDKQwW7P-alnwf5ldCzaGIESfuqSVnBLJtzD191xn_IhI8Q0gwHbJCU5PcFq3eqQ9TxGpRN609y_n72j3WK-AOgE",
    "p": "5PHbJWX2TflCgRediVZSVehKW7iW5KjjOUUe85rvGlOqQD66vOMjJfEJU83srhpI6tfJ3roib2NK9XCEuXhQmeC74kZiLxVQFF8wY6j5mGAGMz6j_EGcoxZNhatLIbKNUtyKhFSo9-buVM5SZNG69WP5jIvGYR586EQv8_OlBB3ubcLYOT49oB7Z-onkIaeeYboXv-TrXJ_JY7DAx0ZKIL8Dvg4kdJtRqFVi5jKfOENnV8Rj90wRcMbBAV7dDDvZhFju0uBm3O1y8sSIw8xBWkA4zgZl-Voscrruepp3MSceOczAtbwFcUwKymWucZ69FSr20iyG3ym6oMR2X4ZBcw",
    "q": "2Kw46Soq47TsYwZvx8GnVM8t8CJDO5yPWPwppVKeYgwTg6du84Lf6WP2KB992J144rioVbfhSefuMZ8f7v_UaQvsPFE4SGRO2JVvBHy49vxI0zGTBAiIvKzQ6bQ3VqXdxdR-NsnQ2XICqhWPEbbqKZ1FmBC6ydaATXoz5nTDX0IAzPH3vaG0YQXrCyIN8iAdsv75BazPZqcjj6cm7CYi87kFvNVghfNAbsPgGnTxhgsgtnjWnWjnrTiy0lYHRPYoRnBSw3gcTlxJSPv-LvVxdEuEscFW0A3VsqlEsKw5FS8Oj8o0iEjiTLtOHTHYggN2dnbmEG0gu1foHqPnyQOPbQ",
    "dp": "zDG6V3y9VYY_fovlghxvixeHWo8kZgULxISVuogxQbXlXy-TteyP6MM2onxD4HSpHGwiLHivRdG1hXs5pYJdwSDj8kj8QSotJj5QFlMbaoAah5ITCGYsoni9476HYCK0UXdKRASOP6zEXPc4HZvBuCPW6zevU-exWCeY7WgdgbKAeX0TBNsyc6GQoRhjVHD_ngIwNIKkORR6tmNrTVCvxM0ZNWW_thDhn9WoQ9Bamf_kKC-NSX-a_o8GjYZieQrYUmZPe92RYPKXV1da8-c1Up19DKRAR0nZ4uo-0TL7o-dT2hF4v55W7Fn6NdLC56vA0SRkx8fW8ytwvPr86O4BaQ",
    "dq": "EmpAxABjeMrttFTdtzqMQDcDjn86-5wIyuVTnMtyzp58Ihpe4a9j3HA0gaB7j6eCmLJdDDv-l8twgSMnEacIpIzw3QeCIxTzZpD8yILZLZSvk9OIzTT0eiSt9M7uTRz3xlKTD5EDgRehhlciu7yyFitZuNzjIzhp2yvhsVqHKFdxvflqtuFBdWWNXnrceJGmNIpbG9JeJjlaWmE4e6WaHuDAzhXMiFXuSfu31kfOJzhW5WtLwkEiP6Sr_hh1sbTCI4p0XkydC0Porp1MMy2FIP8yHfFysWgbm32rauCYUWaYdDwZTuPy59abgvuzjQlCTjs4vnin6YRFJCWGE52L2Q",
    "qi": "G3KQHXu-g2jUpUBDPakzKDRDZu4tZR2TWopcXVUDgaVMCjKW9ffc3d_etPXvpNGtIB8PemO5GJYQJZDdlrK5tOYQwCZm-m_3SMSfUd9F1P1iaJzjnTpy2_Tvj-d9AlZftNHmB83ztWXEf4hKqRqqOFRxceRu4FD3ejP-cQ2L7BaRM62i5DpDNHosiqZH8Sh8wMeL--AIwWSDj7WRJKo54O9YsYRYbkn8Umb9hj1zUbSRjsIzCrVYbIZSCl3Re2rN7S_uqojenCKVGjtH_f7058BLnyxG3gilxVWX6C-aOxXg9YgsYjcRsI_pY4Jsk8aN1WZHGX_w2DgdjBTwMK96JA",
    "kty": "RSA",
}

RSA_PUB_JWK = {
    "n": "wcYWTDju_-S7dgFLMp6VQHbCMHTQD7RxoaTWKY8_NizzW7QX82QZWGyc2-1EpYgza82Joy3IQ78FRV5NHjZONgeot-ZsnznFRokXvzdrshFCv4i-4Jeo9RJW_32T53dM3f7kYJ-n6cDouExHIg03TpQKiB_SiAR8f6K-qa9xOCbFRv5McKvLWxHsSMOx034MQKseSokX-BtPrBrCNzPeor92jljKlamIBvgtJQj_Vi4WvaFloXAZ-4BOZwe51ojujYWuLUHxo4khe5Yd_auV5tKtOIBPFQRgcOOFfVc9J2BiwAk1KkraO4zd-s7GYvQeTd2pVLXUIQO9lLzoCtI_f4e0NAUKNo1CY6UePsxs3Q-RdvxmO09mvq7E8BzqM5rKmpGc7xxuk9R1lZ6aHGe3PIVKfYgPUBn8IIspoZjLhxxhk9BCmwKDRofHqtmVBOk7wWgwebDqEed99pPO63vsctlci1MwUo5OvUDQtd3ULCZr-5TKGPtM33rmDIrGgCOJvhp2jM54KvZpt9IyC2jvwrrcnJV7_9Sipy1Ns-jKvGntcPJbUThjMQGqREFi8G4L8sYMYC5vJz4R1vHcysY3k0hLqyfokkW5eNveba31yzprhUFlikfxHWIZipMb2CFxYN1bukMWnkRJU4ZhUoRWNYg4Kl5rg3_rE-CVfboSGvc",
    "e": "AQAB",
    "kty": "RSA",
}


@pytest.fixture
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


@pytest.fixture
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
    encoded_hs256 = jwt_utils.encode(claims, "secret", headers={**headers, "alg": "HS256"})
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

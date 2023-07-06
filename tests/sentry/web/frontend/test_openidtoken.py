from datetime import datetime

from sentry.testutils import TestCase
from sentry.utils import jwt as jwt_utils
from sentry.web.frontend.openidtoken import OpenIDToken

rsa_private_key = """-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQCc5cHVwwcswaP+7qOym+dmfdoSkBJYIGNl3gH7HWMCLXyz1G2s
+zsicumCzUfI3Mavga7lelHJmWMvTPiNOzG4euXMJunpTSf60nMC7fvdD2Ze1tPy
Zfgw+T2geFYjDBOvpenAjynXTAHLDXpW2al8MRBK8LWtX687X33yuWQ7kwIDAQAB
AoGAUW7Spz8dVzZ+BtAXeJmAheqmJ+JNEx5kWLfcsVg0TioLwk5sSk7vB1c7KZ+g
NXmZSfh2LTbKgmcxWpiJnMvvZq9+xu7s3uxg2qAKQvhCHZ4JStA212KlMLprWipH
v/TJO/05s5tr1aw2qq8aArIkuRHRaFsawv4GAZ1rBNe/0CECQQDPqh/HEuUltF3Y
Jeb4HPQYujLikq7K8XU0W3b/bmqYe7XO6+sxe0dT2jeMW03lq7hDnpthTvUuHk8N
PYioSgfxAkEAwWqiBzqrm5ahz272JTtWwMdlCxGx1il4mgWRX2wl2MXjBGnwgvpV
mLx7DclC+mSQB/KH+gHoIu2IzuEBDKofwwJAW8vOJEfb92DVoviOMttJo6ybVcCV
d6xorO5JmfwLLsBwy7lJzCO8kfqCV478ziusVmfEM62df/dx5l5vDEU9YQJAHN9F
Fp0sdspSlztyJPapqZdaPv/CMzz3ks5X+A2VzLklfUgvLe4ejvE70UAE7onKclVC
9RAJzgT1UiSGWpSerwJATT3pF3yPDbFVqIt4iC7jCXDcXxY/8p3U46x4N85iUpOO
SHlnv/XKEZnYX0pbK2opiSzjAyU7boAZfudsaIcY5w==
-----END RSA PRIVATE KEY-----"""

rsa_public_key = """-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCc5cHVwwcswaP+7qOym+dmfdoS
kBJYIGNl3gH7HWMCLXyz1G2s+zsicumCzUfI3Mavga7lelHJmWMvTPiNOzG4euXM
JunpTSf60nMC7fvdD2Ze1tPyZfgw+T2geFYjDBOvpenAjynXTAHLDXpW2al8MRBK
8LWtX687X33yuWQ7kwIDAQAB
-----END PUBLIC KEY-----"""


class OpenIDTokenTest(TestCase):
    def test_get_encrypted_id_token(self):
        id_token = OpenIDToken("ex_client_id", self.user.id, nonce="abcd")
        encrypted_id_token = id_token.get_encrypted_id_token(rsa_private_key)
        assert encrypted_id_token.count(".") == 2

        decrypted_id_token = jwt_utils.decode(
            encrypted_id_token, rsa_public_key, audience="ex_client_id", algorithms=["RS256"]
        )

        now = datetime.now()
        current_timestamp = datetime.timestamp(now)

        assert decrypted_id_token["aud"] == "ex_client_id"
        assert decrypted_id_token["iss"] == "https://sentry.io"
        assert decrypted_id_token["nonce"] == "abcd"
        assert isinstance(decrypted_id_token["sub"], int)
        assert decrypted_id_token["exp"] > current_timestamp
        assert decrypted_id_token["iat"] < current_timestamp

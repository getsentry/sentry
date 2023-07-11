from datetime import datetime

from sentry.testutils import TestCase
from sentry.utils import jwt as jwt_utils
from sentry.web.frontend.openidtoken import OpenIDToken


class OpenIDTokenTest(TestCase):
    def test_get_encrypted_id_token(self):
        id_token = OpenIDToken("ex_client_id", self.user.id, "shared_secret", nonce="abcd")
        encrypted_id_token = id_token.get_encrypted_id_token()
        assert encrypted_id_token.count(".") == 2

        decrypted_id_token = jwt_utils.decode(
            encrypted_id_token, "shared_secret", audience="ex_client_id"
        )

        now = datetime.now()
        current_timestamp = datetime.timestamp(now)

        assert decrypted_id_token["aud"] == "ex_client_id"
        assert decrypted_id_token["iss"] == "https://sentry.io"
        assert decrypted_id_token["nonce"] == "abcd"
        assert isinstance(decrypted_id_token["sub"], int)
        assert decrypted_id_token["exp"] > current_timestamp
        assert decrypted_id_token["iat"] < current_timestamp

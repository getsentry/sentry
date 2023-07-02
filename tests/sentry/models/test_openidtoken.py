from datetime import datetime

from sentry.models import OpenIDToken
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import jwt as jwt_utils


@control_silo_test(stable=True)
class OpenIDTokenTest(TestCase):
    def test_get_encrypted_id_token(self):
        id_token = OpenIDToken.objects.create(user=self.user, aud="audience", nonce="abcd")
        encrypted_id_token = id_token.get_encrypted_id_token()
        assert encrypted_id_token.count(".") == 2

        decrypted_id_token = jwt_utils.decode(encrypted_id_token, "secret", audience="audience")

        now = datetime.now()
        current_timestamp = datetime.timestamp(now)

        assert decrypted_id_token["aud"] == "audience"
        assert decrypted_id_token["iss"] == "https://sentry.io"
        assert decrypted_id_token["nonce"] == "abcd"
        assert isinstance(decrypted_id_token["sub"], int)
        assert decrypted_id_token["exp"] > current_timestamp
        assert decrypted_id_token["iat"] < current_timestamp

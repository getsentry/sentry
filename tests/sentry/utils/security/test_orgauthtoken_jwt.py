from datetime import datetime

from sentry.testutils import TestCase
from sentry.utils import jwt
from sentry.utils.security.orgauthtoken_jwt import SENTRY_JWT_PREFIX, generate_token, parse_token


class OrgAuthTokenJwtTest(TestCase):
    def test_generate_token(self):
        token = generate_token("test-org", "https://test-region.sentry.io")

        assert token
        assert token.startswith(SENTRY_JWT_PREFIX)

    def test_parse_token(self):
        token = generate_token("test-org", "https://test-region.sentry.io")
        token_payload = parse_token(token)

        assert token_payload["sentry_org"] == "test-org"
        assert token_payload["sentry_url"] == "http://testserver"
        assert token_payload["sentry_region_url"] == "https://test-region.sentry.io"
        assert token_payload["nonce"]

    def test_parse_token_no_dot(self):
        token = generate_token("test-org", "https://test-region.sentry.io")
        # Our JWT tokens end on a dot `.`, which may be confusing, and users _may_ not copy
        # In order to accomodate this, we special case this and add the missing dot for our users
        token_payload = parse_token(token[:-1])

        assert token_payload
        assert token_payload["sentry_org"] == "test-org"
        assert token_payload["sentry_url"] == "http://testserver"
        assert token_payload["sentry_region_url"] == "https://test-region.sentry.io"
        assert token_payload["nonce"]

    def test_parse_invalid_token(self):
        assert parse_token("invalid-token") is None

    def test_parse_invalid_token_iss(self):
        jwt_payload = {
            "iss": "invalid.io",
            "iat": datetime.utcnow(),
            "nonce": "test-nonce",
            "sentry_url": "test-site",
            "sentry_region_url": "test-site",
            "sentry_org": "test-org",
        }

        jwt_token = jwt.encode(jwt_payload, "ABC")
        token = SENTRY_JWT_PREFIX + jwt_token

        assert parse_token(token) is None

    def test_parse_token_changed_secret(self):
        jwt_payload = {
            "iss": "sentry.io",
            "iat": datetime.utcnow(),
            "nonce": "test-nonce",
            "sentry_url": "test-site",
            "sentry_region_url": "test-site",
            "sentry_org": "test-org",
        }

        jwt_token = jwt.encode(jwt_payload, "other-secret-here")
        token = SENTRY_JWT_PREFIX + jwt_token

        token_payload = parse_token(token)

        assert token_payload["sentry_org"] == "test-org"
        assert token_payload["sentry_url"] == "test-site"
        assert token_payload["nonce"]

    def test_generate_token_unique(self):
        jwt1 = generate_token("test-org", "https://test-region.sentry.io")
        jwt2 = generate_token("test-org", "https://test-region.sentry.io")
        jwt3 = generate_token("test-org", "https://test-region.sentry.io")

        assert jwt1
        assert jwt2
        assert jwt3
        assert jwt1 != jwt2
        assert jwt2 != jwt3

import hashlib
from unittest import TestCase

from sentry.service_accounts.tokens import (
    SERVICE_ACCOUNT_TOKEN_PREFIX,
    generate_token,
    parse_token,
    stored_token_fields,
)
from sentry.utils.security import orgauthtoken_token


class ServiceAccountTokenTest(TestCase):
    def test_generate_token_uses_service_account_prefix(self) -> None:
        token = generate_token("test-org", "https://test-region.sentry.io")

        assert SERVICE_ACCOUNT_TOKEN_PREFIX == "sntrym_"
        assert token.startswith("sntrym_")
        assert token.count("_") == 2
        assert token != generate_token("test-org", "https://test-region.sentry.io")

    def test_parse_token(self) -> None:
        token = generate_token("test-org", "https://test-region.sentry.io")
        payload = parse_token(token)

        assert payload is not None
        assert payload["org"] == "test-org"
        assert payload["url"] == "http://testserver"
        assert payload["region_url"] == "https://test-region.sentry.io"
        assert payload["iat"]

    def test_parse_rejects_other_prefixes(self) -> None:
        org_token = orgauthtoken_token.generate_token("test-org", "https://test-region.sentry.io")
        service_account_token = generate_token("test-org", "https://test-region.sentry.io")

        assert parse_token(org_token) is None
        assert orgauthtoken_token.parse_token(service_account_token) is None
        assert parse_token("sntrym_not-a-token") is None

    def test_stored_token_fields_keep_only_hash_and_suffix(self) -> None:
        token = generate_token("test-org", "https://test-region.sentry.io")
        stored = stored_token_fields(token)

        assert stored.token_hashed == hashlib.sha256(token.encode()).hexdigest()
        assert stored.token_last_characters == token[-4:]
        assert token not in repr(stored)
        assert stored.token_hashed not in repr(stored)

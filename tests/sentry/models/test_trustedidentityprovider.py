from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from sentry.models.trustedidentityprovider import TrustedIdentityProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TrustedIdentityProviderTest(TestCase):
    def test_create_basic(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
        )

        assert idp.organization_id == self.organization.id
        assert idp.issuer == "https://acme.okta.com"
        assert idp.name == "Acme Okta"
        assert idp.jwks_uri == "https://acme.okta.com/.well-known/jwks.json"
        assert idp.subject_claim == "sub"
        assert idp.tenant_claim is None
        assert idp.allowed_client_ids == []
        assert idp.allowed_scopes == []
        assert idp.enabled is True
        assert idp.jwks_cache is None
        assert idp.jwks_cached_at is None

    def test_issuer_unique_per_org(self) -> None:
        TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
        )

        # Same issuer in same org should fail
        with pytest.raises(IntegrityError):
            TrustedIdentityProvider.objects.create(
                organization_id=self.organization.id,
                issuer="https://acme.okta.com",
                name="Duplicate",
                jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            )

    def test_same_issuer_different_orgs(self) -> None:
        other_org = self.create_organization()

        idp1 = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta Org1",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
        )

        # Same issuer in different org should succeed
        idp2 = TrustedIdentityProvider.objects.create(
            organization_id=other_org.id,
            issuer="https://acme.okta.com",
            name="Acme Okta Org2",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
        )

        assert idp1.issuer == idp2.issuer
        assert idp1.organization_id != idp2.organization_id

    def test_str_representation(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
        )

        assert str(idp) == "Acme Okta (https://acme.okta.com)"

    def test_is_jwks_cache_valid_no_cache(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
        )

        assert idp.is_jwks_cache_valid() is False

    def test_is_jwks_cache_valid_fresh_cache(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            jwks_cache={"keys": []},
            jwks_cached_at=timezone.now(),
        )

        assert idp.is_jwks_cache_valid() is True

    def test_is_jwks_cache_valid_stale_cache(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            jwks_cache={"keys": []},
            jwks_cached_at=timezone.now() - timedelta(hours=2),
        )

        # Default TTL is 1 hour
        assert idp.is_jwks_cache_valid() is False

    def test_is_jwks_cache_valid_custom_ttl(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            jwks_cache={"keys": []},
            jwks_cached_at=timezone.now() - timedelta(minutes=30),
        )

        # With 1 hour TTL, 30 min old cache is valid
        assert idp.is_jwks_cache_valid(max_age_seconds=3600) is True

        # With 15 min TTL, 30 min old cache is invalid
        assert idp.is_jwks_cache_valid(max_age_seconds=900) is False

    def test_update_jwks_cache(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
        )

        assert idp.jwks_cache is None
        assert idp.jwks_cached_at is None

        jwks_data = {
            "keys": [
                {
                    "kty": "RSA",
                    "kid": "test-key-1",
                    "n": "test-modulus",
                    "e": "AQAB",
                }
            ]
        }

        idp.update_jwks_cache(jwks_data)

        # Refresh from DB
        idp.refresh_from_db()

        assert idp.jwks_cache == jwks_data
        assert idp.jwks_cached_at is not None
        assert idp.is_jwks_cache_valid() is True

    def test_is_client_allowed_empty_list(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            allowed_client_ids=[],
        )

        # Empty list means all clients allowed
        assert idp.is_client_allowed("any-client-id") is True
        assert idp.is_client_allowed("another-client") is True

    def test_is_client_allowed_restricted_list(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            allowed_client_ids=["cursor-client-id", "vscode-client-id"],
        )

        assert idp.is_client_allowed("cursor-client-id") is True
        assert idp.is_client_allowed("vscode-client-id") is True
        assert idp.is_client_allowed("unknown-client") is False

    def test_get_audit_log_data(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            enabled=True,
        )

        audit_data = idp.get_audit_log_data()

        assert audit_data == {
            "organization_id": self.organization.id,
            "issuer": "https://acme.okta.com",
            "name": "Acme Okta",
            "jwks_uri": "https://acme.okta.com/.well-known/jwks.json",
            "enabled": True,
        }

    def test_with_custom_claims(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            subject_claim="email",
            tenant_claim="org_id",
        )

        assert idp.subject_claim == "email"
        assert idp.tenant_claim == "org_id"

    def test_with_scope_restrictions(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            allowed_scopes=["org:read", "project:read"],
        )

        assert idp.allowed_scopes == ["org:read", "project:read"]

    def test_disabled_provider(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            enabled=False,
        )

        assert idp.enabled is False

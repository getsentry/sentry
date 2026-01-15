from datetime import timedelta

import orjson
import pytest
import responses
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from django.db import IntegrityError
from django.utils import timezone
from jwt import algorithms as jwt_algorithms
from requests.exceptions import ConnectionError as RequestsConnectionError

from sentry.models.trustedidentityprovider import (
    IdPDisabledError,
    JWKSFetchError,
    JWTValidationError,
    KeyNotFoundError,
    TrustedIdentityProvider,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import jwt


def generate_rsa_key_pair():
    """Generate an RSA key pair for testing. Returns (private_key, private_key_pem)."""
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    return private_key, private_key_pem


def private_key_to_jwk(private_key, kid: str) -> dict:
    """Convert an RSA private key to JWK format (public key only)."""
    public_key = private_key.public_key()
    # Use pyjwt's algorithm to convert to JWK (returns JSON string)
    jwk_json = jwt_algorithms.RSAAlgorithm.to_jwk(public_key)
    jwk_dict = orjson.loads(jwk_json)
    jwk_dict["kid"] = kid
    jwk_dict["use"] = "sig"
    jwk_dict["alg"] = "RS256"
    return jwk_dict


def create_signed_jwt(private_key_pem: str, claims: dict, kid: str) -> str:
    """Create a signed JWT for testing."""
    return jwt.encode(
        claims,
        private_key_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )


def generate_ec_key_pair():
    """Generate an EC P-256 key pair for testing. Returns (private_key, private_key_pem)."""
    private_key = ec.generate_private_key(ec.SECP256R1(), backend=default_backend())
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    return private_key, private_key_pem


def ec_private_key_to_jwk(private_key, kid: str) -> dict:
    """Convert an EC private key to JWK format (public key only)."""
    import base64

    public_key = private_key.public_key()
    public_numbers = public_key.public_numbers()

    # Get the curve size in bytes for proper padding
    curve_size = (public_key.curve.key_size + 7) // 8

    # Convert coordinates to base64url-encoded bytes
    x_bytes = public_numbers.x.to_bytes(curve_size, byteorder="big")
    y_bytes = public_numbers.y.to_bytes(curve_size, byteorder="big")

    return {
        "kty": "EC",
        "crv": "P-256",
        "x": base64.urlsafe_b64encode(x_bytes).rstrip(b"=").decode("ascii"),
        "y": base64.urlsafe_b64encode(y_bytes).rstrip(b"=").decode("ascii"),
        "kid": kid,
        "use": "sig",
        "alg": "ES256",
    }


def create_signed_ec_jwt(private_key_pem: str, claims: dict, kid: str) -> str:
    """Create a signed JWT using ES256 algorithm for testing."""
    return jwt.encode(
        claims,
        private_key_pem,
        algorithm="ES256",
        headers={"kid": kid},
    )


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

        assert idp.is_jwks_cache_valid(max_age_seconds=3600) is True
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

        # Refresh from DB - use fresh variable to avoid mypy type narrowing issues
        updated_idp = TrustedIdentityProvider.objects.get(id=idp.id)

        assert updated_idp.jwks_cache == jwks_data
        assert updated_idp.jwks_cached_at is not None
        assert updated_idp.is_jwks_cache_valid() is True

    def test_is_client_allowed_empty_list(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            allowed_client_ids=[],
        )

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


@control_silo_test
class TrustedIdentityProviderJWKSTest(TestCase):
    """Tests for JWKS fetching functionality."""

    @responses.activate
    def test_fetch_jwks_success(self) -> None:
        jwks_uri = "https://acme.okta.com/.well-known/jwks.json"
        jwks_data = {
            "keys": [
                {
                    "kty": "RSA",
                    "kid": "test-key-1",
                    "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
                    "e": "AQAB",
                    "use": "sig",
                    "alg": "RS256",
                }
            ]
        }

        responses.add(
            responses.GET,
            jwks_uri,
            json=jwks_data,
            status=200,
        )

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=jwks_uri,
        )

        result = idp.fetch_jwks()

        assert result == jwks_data
        idp.refresh_from_db()
        assert idp.jwks_cache == jwks_data
        assert idp.jwks_cached_at is not None
        assert idp.is_jwks_cache_valid() is True

    @responses.activate
    def test_fetch_jwks_network_error(self) -> None:
        jwks_uri = "https://acme.okta.com/.well-known/jwks.json"

        responses.add(
            responses.GET,
            jwks_uri,
            body=RequestsConnectionError("Connection refused"),
        )

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=jwks_uri,
        )

        with pytest.raises(JWKSFetchError) as exc_info:
            idp.fetch_jwks()

        assert "Failed to fetch JWKS" in str(exc_info.value)

    @responses.activate
    def test_fetch_jwks_http_error(self) -> None:
        jwks_uri = "https://acme.okta.com/.well-known/jwks.json"

        responses.add(
            responses.GET,
            jwks_uri,
            status=500,
        )

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=jwks_uri,
        )

        with pytest.raises(JWKSFetchError) as exc_info:
            idp.fetch_jwks()

        assert "Failed to fetch JWKS" in str(exc_info.value)

    @responses.activate
    def test_fetch_jwks_invalid_json(self) -> None:
        jwks_uri = "https://acme.okta.com/.well-known/jwks.json"

        responses.add(
            responses.GET,
            jwks_uri,
            body="not valid json",
            status=200,
            content_type="application/json",
        )

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=jwks_uri,
        )

        with pytest.raises(JWKSFetchError) as exc_info:
            idp.fetch_jwks()

        assert "Invalid JSON" in str(exc_info.value)

    @responses.activate
    def test_fetch_jwks_missing_keys(self) -> None:
        jwks_uri = "https://acme.okta.com/.well-known/jwks.json"

        responses.add(
            responses.GET,
            jwks_uri,
            json={"not_keys": []},
            status=200,
        )

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=jwks_uri,
        )

        with pytest.raises(JWKSFetchError) as exc_info:
            idp.fetch_jwks()

        assert "missing 'keys' field" in str(exc_info.value)

    def test_get_public_key_success(self) -> None:
        private_key, _ = generate_rsa_key_pair()
        jwk = private_key_to_jwk(private_key, "test-key-1")

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            jwks_cache={"keys": [jwk]},
            jwks_cached_at=timezone.now(),
        )

        pem_key = idp.get_public_key("test-key-1")

        assert pem_key is not None
        assert "BEGIN PUBLIC KEY" in pem_key

    def test_get_public_key_not_found(self) -> None:
        private_key, _ = generate_rsa_key_pair()
        jwk = private_key_to_jwk(private_key, "test-key-1")

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            jwks_cache={"keys": [jwk]},
            jwks_cached_at=timezone.now(),
        )

        with pytest.raises(KeyNotFoundError) as exc_info:
            idp.get_public_key("nonexistent-key")

        assert "not found in JWKS" in str(exc_info.value)

    def test_get_public_key_no_cache(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
        )

        with pytest.raises(KeyNotFoundError) as exc_info:
            idp.get_public_key("any-key")

        assert "No JWKS cache available" in str(exc_info.value)

    def test_get_public_key_ec_key(self) -> None:
        """Test that EC keys (ES256/ES384/ES512) are supported."""
        private_key, _ = generate_ec_key_pair()
        jwk = ec_private_key_to_jwk(private_key, "ec-key-1")

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            jwks_cache={"keys": [jwk]},
            jwks_cached_at=timezone.now(),
        )

        pem_key = idp.get_public_key("ec-key-1")

        assert pem_key is not None
        assert "BEGIN PUBLIC KEY" in pem_key

    def test_get_public_key_unsupported_key_type(self) -> None:
        """Test that unsupported key types are rejected."""
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri="https://acme.okta.com/.well-known/jwks.json",
            jwks_cache={
                "keys": [
                    {
                        "kty": "OKP",  # Ed25519 - not supported
                        "kid": "okp-key-1",
                    }
                ]
            },
            jwks_cached_at=timezone.now(),
        )

        with pytest.raises(JWTValidationError) as exc_info:
            idp.get_public_key("okp-key-1")

        assert "Unsupported key type 'OKP'" in str(exc_info.value)


@control_silo_test
class TrustedIdentityProviderJWTValidationTest(TestCase):
    """Tests for JWT signature validation."""

    def setUp(self):
        super().setUp()
        self.private_key, self.private_key_pem = generate_rsa_key_pair()
        self.kid = "test-key-1"
        self.jwk = private_key_to_jwk(self.private_key, self.kid)
        self.jwks_uri = "https://acme.okta.com/.well-known/jwks.json"

    def test_validate_jwt_signature_success(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now(),
        )

        claims = {
            "sub": "user@example.com",
            "iss": "https://acme.okta.com",
            "aud": "sentry.io",
        }
        token = create_signed_jwt(self.private_key_pem, claims, self.kid)

        result = idp.validate_jwt_signature(token, audience="sentry.io")

        assert result["sub"] == "user@example.com"
        assert result["iss"] == "https://acme.okta.com"
        assert result["aud"] == "sentry.io"

    def test_validate_jwt_signature_ec_key(self) -> None:
        """Test JWT validation with EC (ES256) key."""
        ec_private_key, ec_private_key_pem = generate_ec_key_pair()
        ec_kid = "ec-key-1"
        ec_jwk = ec_private_key_to_jwk(ec_private_key, ec_kid)

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [ec_jwk]},
            jwks_cached_at=timezone.now(),
        )

        claims = {
            "sub": "user@example.com",
            "iss": "https://acme.okta.com",
            "aud": "sentry.io",
        }
        token = create_signed_ec_jwt(ec_private_key_pem, claims, ec_kid)

        result = idp.validate_jwt_signature(token, audience="sentry.io")

        assert result["sub"] == "user@example.com"
        assert result["iss"] == "https://acme.okta.com"

    def test_validate_jwt_disabled_idp(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now(),
            enabled=False,
        )

        claims = {"sub": "user@example.com"}
        token = create_signed_jwt(self.private_key_pem, claims, self.kid)

        with pytest.raises(IdPDisabledError) as exc_info:
            idp.validate_jwt_signature(token)

        assert "is disabled" in str(exc_info.value)

    def test_validate_jwt_signature_no_audience_check(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now(),
        )

        claims = {
            "sub": "user@example.com",
            "iss": "https://acme.okta.com",
        }
        token = create_signed_jwt(self.private_key_pem, claims, self.kid)

        result = idp.validate_jwt_signature(token)

        assert result["sub"] == "user@example.com"

    def test_validate_jwt_invalid_signature(self) -> None:
        other_private_key, other_private_key_pem = generate_rsa_key_pair()

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now(),
        )

        claims = {"sub": "user@example.com"}
        token = create_signed_jwt(other_private_key_pem, claims, self.kid)

        with pytest.raises(JWTValidationError) as exc_info:
            idp.validate_jwt_signature(token)

        assert "signature validation failed" in str(exc_info.value)

    def test_validate_jwt_missing_kid(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now(),
        )

        claims = {"sub": "user@example.com"}
        token = jwt.encode(claims, self.private_key_pem, algorithm="RS256")

        with pytest.raises(JWTValidationError) as exc_info:
            idp.validate_jwt_signature(token)

        assert "missing 'kid'" in str(exc_info.value)

    def test_validate_jwt_unsupported_algorithm(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now(),
        )

        claims = {"sub": "user@example.com"}
        token = jwt.encode(
            claims,
            "secret",
            algorithm="HS256",
            headers={"kid": self.kid},
        )

        with pytest.raises(JWTValidationError) as exc_info:
            idp.validate_jwt_signature(token)

        assert "Unsupported JWT algorithm" in str(exc_info.value)

    def test_validate_jwt_malformed_token(self) -> None:
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now(),
        )

        with pytest.raises(JWTValidationError) as exc_info:
            idp.validate_jwt_signature("not.a.valid.jwt")

        assert "Invalid JWT format" in str(exc_info.value)

    @responses.activate
    def test_validate_jwt_refreshes_cache_on_stale(self) -> None:
        responses.add(
            responses.GET,
            self.jwks_uri,
            json={"keys": [self.jwk]},
            status=200,
        )

        # Create IdP with stale cache
        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk]},
            jwks_cached_at=timezone.now() - timedelta(hours=2),  # Stale
        )

        claims = {"sub": "user@example.com"}
        token = create_signed_jwt(self.private_key_pem, claims, self.kid)

        result = idp.validate_jwt_signature(token)

        assert result["sub"] == "user@example.com"
        assert len(responses.calls) == 1

    @responses.activate
    def test_validate_jwt_refreshes_on_missing_key(self) -> None:
        responses.add(
            responses.GET,
            self.jwks_uri,
            json={"keys": [self.jwk]},  # Now includes our key
            status=200,
        )

        # Create a different key that's in the initial cache
        other_private_key, _ = generate_rsa_key_pair()
        other_jwk = private_key_to_jwk(other_private_key, "other-key")

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [other_jwk]},  # Only has the other key
            jwks_cached_at=timezone.now(),
        )

        claims = {"sub": "user@example.com"}
        token = create_signed_jwt(self.private_key_pem, claims, self.kid)

        result = idp.validate_jwt_signature(token)

        assert result["sub"] == "user@example.com"
        assert len(responses.calls) == 1

    def test_validate_jwt_no_refresh_when_disabled(self) -> None:
        other_private_key, _ = generate_rsa_key_pair()
        other_jwk = private_key_to_jwk(other_private_key, "other-key")

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [other_jwk]},  # Only has the other key
            jwks_cached_at=timezone.now(),
        )

        claims = {"sub": "user@example.com"}
        token = create_signed_jwt(self.private_key_pem, claims, self.kid)

        with pytest.raises(KeyNotFoundError):
            idp.validate_jwt_signature(token, refresh_on_missing_key=False)

    @responses.activate
    def test_validate_jwt_with_no_initial_cache(self) -> None:
        responses.add(
            responses.GET,
            self.jwks_uri,
            json={"keys": [self.jwk]},
            status=200,
        )

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            # No cache set
        )

        claims = {"sub": "user@example.com"}
        token = create_signed_jwt(self.private_key_pem, claims, self.kid)

        result = idp.validate_jwt_signature(token)

        assert result["sub"] == "user@example.com"
        assert len(responses.calls) == 1

    def test_validate_jwt_with_multiple_keys(self) -> None:
        private_key2, private_key2_pem = generate_rsa_key_pair()
        jwk2 = private_key_to_jwk(private_key2, "test-key-2")

        idp = TrustedIdentityProvider.objects.create(
            organization_id=self.organization.id,
            issuer="https://acme.okta.com",
            name="Acme Okta",
            jwks_uri=self.jwks_uri,
            jwks_cache={"keys": [self.jwk, jwk2]},
            jwks_cached_at=timezone.now(),
        )

        claims = {"sub": "user@example.com"}
        token = create_signed_jwt(private_key2_pem, claims, "test-key-2")

        result = idp.validate_jwt_signature(token)

        assert result["sub"] == "user@example.com"

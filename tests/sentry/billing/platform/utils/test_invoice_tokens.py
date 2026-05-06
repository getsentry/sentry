from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sentry.billing.platform.utils.invoice_tokens import (
    InvoiceTokenGenerator,
    generate_invoice_access_token,
    validate_invoice_access_token,
)


class TestInvoiceTokenGenerator:
    def test_generate_token(self):
        """Test basic token generation."""
        generator = InvoiceTokenGenerator(secret="test-secret")
        invoice_id = "inv_test123"

        token = generator.generate_token(invoice_id)

        assert token is not None
        assert isinstance(token, str)
        parts = token.split(".")
        assert len(parts) == 3
        assert parts[0] == invoice_id

    def test_validate_token_success(self):
        """Test successful token validation."""
        generator = InvoiceTokenGenerator(secret="test-secret")
        invoice_id = "inv_test123"

        token = generator.generate_token(invoice_id)
        validated_id = generator.validate_token(token)

        assert validated_id == invoice_id

    def test_validate_token_expired(self):
        """Test validation of expired token."""
        generator = InvoiceTokenGenerator(secret="test-secret")
        invoice_id = "inv_test123"

        past_time = datetime.now(UTC) - timedelta(days=100)
        with patch("sentry.billing.platform.utils.invoice_tokens.datetime") as mock_dt:
            mock_dt.now.return_value = past_time
            token = generator.generate_token(invoice_id, valid_days=1)

        validated_id = generator.validate_token(token)
        assert validated_id is None

    def test_validate_token_invalid_signature(self):
        """Test validation with tampered signature."""
        generator = InvoiceTokenGenerator(secret="test-secret")
        invoice_id = "inv_test123"

        token = generator.generate_token(invoice_id)
        parts = token.split(".")
        tampered_token = f"{parts[0]}.{parts[1]}.invalid_signature"

        validated_id = generator.validate_token(tampered_token)
        assert validated_id is None

    def test_validate_token_wrong_secret(self):
        """Test validation with different secret key."""
        generator1 = InvoiceTokenGenerator(secret="secret1")
        generator2 = InvoiceTokenGenerator(secret="secret2")
        invoice_id = "inv_test123"

        token = generator1.generate_token(invoice_id)
        validated_id = generator2.validate_token(token)

        assert validated_id is None

    def test_validate_token_malformed(self):
        """Test validation of malformed tokens."""
        generator = InvoiceTokenGenerator(secret="test-secret")

        assert generator.validate_token("") is None
        assert generator.validate_token("invalid") is None
        assert generator.validate_token("a.b") is None
        assert generator.validate_token("a.b.c.d") is None

    def test_validate_token_non_numeric_expiry(self):
        """Test validation with non-numeric expiry."""
        generator = InvoiceTokenGenerator(secret="test-secret")
        invalid_token = "inv_123.notanumber.abcd1234"

        validated_id = generator.validate_token(invalid_token)
        assert validated_id is None

    def test_custom_validity_period(self):
        """Test token generation with custom validity period."""
        generator = InvoiceTokenGenerator(secret="test-secret")
        invoice_id = "inv_test123"

        token = generator.generate_token(invoice_id, valid_days=30)
        validated_id = generator.validate_token(token)

        assert validated_id == invoice_id

    def test_convenience_functions(self):
        """Test convenience wrapper functions."""
        invoice_id = "inv_test123"

        token = generate_invoice_access_token(invoice_id)
        assert token is not None

        validated_id = validate_invoice_access_token(token)
        assert validated_id == invoice_id

    def test_token_uniqueness_with_different_invoices(self):
        """Test that different invoices get different tokens."""
        generator = InvoiceTokenGenerator(secret="test-secret")

        token1 = generator.generate_token("inv_1")
        token2 = generator.generate_token("inv_2")

        assert token1 != token2
        assert generator.validate_token(token1) == "inv_1"
        assert generator.validate_token(token2) == "inv_2"

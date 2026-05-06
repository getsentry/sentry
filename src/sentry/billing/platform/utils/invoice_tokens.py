from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from django.conf import settings


class InvoiceTokenGenerator:
    """
    Generates and validates secure tokens for unauthenticated invoice PDF access.

    Tokens are HMAC-based and include:
    - Invoice ID
    - Timestamp for expiration
    - Secret key from settings

    This allows customers to access their invoices via email links without logging in.
    """

    def __init__(self, secret: str | None = None):
        """
        Initialize token generator.

        Args:
            secret: Secret key for HMAC. Defaults to SECRET_KEY from settings.
        """
        self.secret = secret or settings.SECRET_KEY

    def generate_token(self, invoice_id: str, valid_days: int = 90) -> str:
        """
        Generate a secure token for an invoice.

        Args:
            invoice_id: The invoice ID (GUID)
            valid_days: Number of days the token remains valid

        Returns:
            URL-safe token string
        """
        timestamp = datetime.now(UTC).timestamp()
        expiry = timestamp + (valid_days * 24 * 60 * 60)

        message = f"{invoice_id}:{int(expiry)}"
        signature = hmac.new(
            self.secret.encode(), message.encode(), hashlib.sha256
        ).hexdigest()

        return f"{invoice_id}.{int(expiry)}.{signature}"

    def validate_token(self, token: str) -> str | None:
        """
        Validate a token and return the invoice ID if valid.

        Args:
            token: The token to validate

        Returns:
            Invoice ID if token is valid, None otherwise
        """
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None

            invoice_id, expiry_str, signature = parts
            expiry = int(expiry_str)

            if datetime.now(UTC).timestamp() > expiry:
                return None

            message = f"{invoice_id}:{expiry}"
            expected_signature = hmac.new(
                self.secret.encode(), message.encode(), hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(signature, expected_signature):
                return None

            return invoice_id

        except (ValueError, AttributeError):
            return None


def generate_invoice_access_token(invoice_id: str) -> str:
    """
    Generate a secure access token for an invoice.

    This is a convenience function that uses the default token generator.

    Args:
        invoice_id: The invoice ID (GUID)

    Returns:
        URL-safe token string valid for 90 days
    """
    generator = InvoiceTokenGenerator()
    return generator.generate_token(invoice_id)


def validate_invoice_access_token(token: str) -> str | None:
    """
    Validate an invoice access token.

    This is a convenience function that uses the default token generator.

    Args:
        token: The token to validate

    Returns:
        Invoice ID if token is valid, None otherwise
    """
    generator = InvoiceTokenGenerator()
    return generator.validate_token(token)

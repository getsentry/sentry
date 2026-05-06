from __future__ import annotations

from sentry.billing.platform.utils.invoice_tokens import generate_invoice_access_token
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestInvoicePdfView(TestCase):
    def setUp(self):
        super().setUp()
        self.invoice_id = "inv_test12345"
        self.url = f"/invoices/pdf/{self.invoice_id}/"

    def test_missing_token(self):
        """Test access without token returns 404."""
        response = self.client.get(self.url)

        assert response.status_code == 404

    def test_invalid_token(self):
        """Test access with invalid token returns 404."""
        response = self.client.get(self.url, {"token": "invalid_token"})

        assert response.status_code == 404

    def test_valid_token_wrong_invoice(self):
        """Test valid token for different invoice returns 404."""
        token = generate_invoice_access_token("inv_different")

        response = self.client.get(self.url, {"token": token})

        assert response.status_code == 404

    def test_valid_token_returns_404_placeholder(self):
        """Test valid token returns 404 (placeholder until PDF generation implemented)."""
        token = generate_invoice_access_token(self.invoice_id)

        response = self.client.get(self.url, {"token": token})

        assert response.status_code == 404

    def test_unauthenticated_access_allowed(self):
        """Test that the view allows unauthenticated access with valid token."""
        self.client.logout()
        token = generate_invoice_access_token(self.invoice_id)

        response = self.client.get(self.url, {"token": token})

        assert response.status_code == 404

    def test_token_specific_to_invoice_id(self):
        """Test that token validation checks invoice ID match."""
        invoice_id_1 = "inv_111"
        invoice_id_2 = "inv_222"

        token_1 = generate_invoice_access_token(invoice_id_1)
        token_2 = generate_invoice_access_token(invoice_id_2)

        url_1 = f"/invoices/pdf/{invoice_id_1}/"
        url_2 = f"/invoices/pdf/{invoice_id_2}/"

        response = self.client.get(url_1, {"token": token_2})
        assert response.status_code == 404

        response = self.client.get(url_2, {"token": token_1})
        assert response.status_code == 404

        response = self.client.get(url_1, {"token": token_1})
        assert response.status_code == 404

        response = self.client.get(url_2, {"token": token_2})
        assert response.status_code == 404

from __future__ import annotations

import logging

from django.http import Http404, HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry.billing.platform.utils.invoice_tokens import validate_invoice_access_token
from sentry.web.frontend.base import control_silo_view

logger = logging.getLogger(__name__)


@control_silo_view
@method_decorator(csrf_exempt, name="dispatch")
class InvoicePdfView(View):
    """
    Serves invoice PDFs via token-based authentication.

    This view allows unauthenticated users to access invoice PDFs using a secure token.
    The token is typically sent via email and provides time-limited access to the invoice.

    URL pattern: /invoices/pdf/<invoice_id>/?token=<token>

    Security:
    - Token must be valid and not expired
    - Token is specific to the invoice ID
    - CSRF exempt since this is unauthenticated and read-only
    """

    def get(self, request: HttpRequest, invoice_id: str) -> HttpResponse:
        """
        Serve an invoice PDF using token authentication.

        Args:
            request: The HTTP request
            invoice_id: The invoice ID (GUID)

        Returns:
            HttpResponse with PDF content or 404 if invalid

        Raises:
            Http404: If token is invalid or invoice not found
        """
        token = request.GET.get("token")

        if not token:
            logger.warning(
                "invoice.pdf.access.no_token",
                extra={"invoice_id": invoice_id},
            )
            raise Http404("Invalid access token")

        validated_invoice_id = validate_invoice_access_token(token)

        if validated_invoice_id != invoice_id:
            logger.warning(
                "invoice.pdf.access.invalid_token",
                extra={
                    "invoice_id": invoice_id,
                    "validated_id": validated_invoice_id,
                },
            )
            raise Http404("Invalid or expired access token")

        logger.info(
            "invoice.pdf.access.success",
            extra={"invoice_id": invoice_id},
        )

        return self._serve_invoice_pdf(invoice_id)

    def _serve_invoice_pdf(self, invoice_id: str) -> HttpResponse:
        """
        Fetch and serve the invoice PDF.

        This is a placeholder that should be implemented to:
        1. Query the invoice from the billing platform
        2. Generate or fetch the PDF
        3. Return it with appropriate headers

        Args:
            invoice_id: The invoice ID

        Returns:
            HttpResponse with PDF content

        Raises:
            Http404: If invoice not found
        """
        logger.info(
            "invoice.pdf.serve",
            extra={"invoice_id": invoice_id},
        )
        raise Http404("Invoice PDF generation not yet implemented")

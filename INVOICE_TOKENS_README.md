# Invoice Token-Based PDF Access Implementation

## Overview

This implementation provides secure, token-based authentication for accessing invoice PDFs without requiring user login. This allows customers to view their invoices via email links.

## Components

### 1. Token Generation & Validation (`src/sentry/billing/platform/utils/invoice_tokens.py`)

The `InvoiceTokenGenerator` class provides:

- **Secure Token Generation**: Uses HMAC-SHA256 signatures with Django's SECRET_KEY
- **Time-Limited Tokens**: 90-day expiration by default (configurable)
- **Invoice-Specific Tokens**: Each token is tied to a specific invoice ID
- **Tampering Prevention**: Any modification to the token invalidates it

#### Token Format
```
<invoice_id>.<expiry_timestamp>.<hmac_signature>
```

#### Usage Example
```python
from sentry.billing.platform.utils import generate_invoice_access_token

# Generate a token for an invoice
token = generate_invoice_access_token("inv_abc123")

# Token can be included in email URLs
url = f"https://sentry.io/invoices/pdf/inv_abc123/?token={token}"
```

### 2. PDF View (`src/sentry/web/frontend/invoice_pdf.py`)

The `InvoicePdfView` provides:

- **Unauthenticated Access**: No login required, only valid token
- **Token Validation**: Verifies token matches the invoice ID
- **CSRF Exempt**: Since it's read-only and unauthenticated
- **Control Silo**: Billing data lives in the control silo

#### URL Pattern
```
/invoices/pdf/<invoice_id>/?token=<token>
```

### 3. URL Routing (`src/sentry/web/urls.py`)

Added route:
```python
re_path(
    r"^invoices/pdf/(?P<invoice_id>[^/]+)/$",
    InvoicePdfView.as_view(),
    name="sentry-invoice-pdf",
)
```

## Security Considerations

1. **HMAC Signatures**: Tokens cannot be forged without access to Django's SECRET_KEY
2. **Time Limits**: Tokens expire after 90 days to limit exposure window
3. **Invoice-Specific**: A token for invoice A cannot access invoice B
4. **No IDOR Risk**: Token must match invoice ID in URL
5. **Constant-Time Comparison**: Uses `hmac.compare_digest()` to prevent timing attacks

## Testing

### Token Generator Tests (`tests/sentry/billing/platform/utils/test_invoice_tokens.py`)

Tests cover:
- Basic token generation and validation
- Expired token rejection
- Tampered signature detection
- Different secret key rejection
- Malformed token handling
- Custom validity periods
- Token uniqueness per invoice

### View Tests (`tests/sentry/web/frontend/test_invoice_pdf.py`)

Tests cover:
- Missing token returns 404
- Invalid token returns 404
- Token for wrong invoice returns 404
- Unauthenticated access allowed with valid token
- Invoice ID validation

## Integration with Billing Platform

### Required Implementation Steps

1. **Implement `_serve_invoice_pdf` method**:
   ```python
   def _serve_invoice_pdf(self, invoice_id: str) -> HttpResponse:
       # Query invoice from billing platform
       # Generate or fetch PDF
       # Return HttpResponse with PDF content
       pass
   ```

2. **Add Token Generation to Invoice Emails**:
   ```python
   from sentry.billing.platform.utils import generate_invoice_access_token
   
   def send_invoice_email(invoice):
       token = generate_invoice_access_token(invoice.id)
       pdf_url = f"{settings.SENTRY_URL_PREFIX}/invoices/pdf/{invoice.id}/?token={token}"
       # Include pdf_url in email template
   ```

3. **Update Invoice Serializer**:
   ```python
   class InvoiceSerializer(Serializer):
       def serialize(self, obj, attrs, user, **kwargs):
           token = generate_invoice_access_token(obj.id)
           return {
               "id": obj.id,
               "receipt": {
                   "url": f"/invoices/pdf/{obj.id}/?token={token}"
               },
               # ... other fields
           }
   ```

## API Usage

### Generating Tokens

```python
from sentry.billing.platform.utils import generate_invoice_access_token

# Generate token with default 90-day expiration
token = generate_invoice_access_token("inv_123")

# Generate token with custom expiration
from sentry.billing.platform.utils import InvoiceTokenGenerator
generator = InvoiceTokenGenerator()
token = generator.generate_token("inv_123", valid_days=30)
```

### Validating Tokens

```python
from sentry.billing.platform.utils import validate_invoice_access_token

invoice_id = validate_invoice_access_token(token)
if invoice_id:
    # Token is valid
    pass
else:
    # Token is invalid or expired
    pass
```

## Future Enhancements

1. **PDF Generation**: Integrate with invoice PDF generation service
2. **Analytics**: Track PDF access for monitoring
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Email Tracking**: Track when invoice emails are opened
5. **Revocation**: Add ability to revoke specific tokens if needed

## Related Files

- `src/sentry/billing/platform/utils/invoice_tokens.py` - Token generator
- `src/sentry/billing/platform/utils/__init__.py` - Package exports
- `src/sentry/web/frontend/invoice_pdf.py` - PDF view
- `src/sentry/web/urls.py` - URL routing
- `tests/sentry/billing/platform/utils/test_invoice_tokens.py` - Token tests
- `tests/sentry/web/frontend/test_invoice_pdf.py` - View tests

## Issue Tracking

- Linear Issue: REVENG-46
- Feature: Handle invoice tokens for unauthenticated PDF access

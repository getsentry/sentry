# Invoice Address Persistence Design

## Problem Statement

Currently, when rendering invoice PDFs, the system fetches the customer's address from their current billing details. This creates historical inaccuracy issues:

- If a customer updates their address after an invoice is created, old invoices will show the new address
- Invoices should reflect the billing address as it was at the time of invoice creation
- Legal and compliance requirements dictate that invoices should be immutable records

## Current State

### Data Models

**Invoice Model** (TypeScript):
```typescript
export type InvoiceBase = StructuredAddress & {
  // ... other fields
};

type StructuredAddress = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  countryCode: string | null;
  postalCode: string | null;
  region: string | null;
};
```

**Billing Details Model** (TypeScript):
```typescript
export type BillingDetails = StructuredAddress & {
  addressType: AddressType | null;
  billingEmail: string | null;
  companyName: string | null;
  displayAddress: string | null;
  taxNumber: string | null;
};
```

### Current Behavior

1. **Invoice Creation**: Invoice is created with address fields potentially null or not populated
2. **PDF Rendering**: System fetches current `BillingDetails` and uses that address in the PDF
3. **Problem**: If billing details change, historical invoices reflect the new address, not the original

## Proposed Solution

### 1. Populate Address at Invoice Creation

When creating an invoice:

1. Fetch the customer's current `BillingDetails`
2. Copy all `StructuredAddress` fields to the invoice model:
   - `addressLine1`
   - `addressLine2`
   - `city`
   - `countryCode`
   - `postalCode`
   - `region`
3. Also copy additional billing context:
   - `companyName` (if not already on invoice)
   - `taxNumber` (if not already on invoice)
   - `displayAddress` (if useful for rendering)

### 2. Update PDF Rendering

When rendering invoice PDFs:

1. Use the address fields directly from the `Invoice` model
2. **Do not** fetch from `BillingDetails`
3. Fall back to `BillingDetails` only if invoice address fields are null (for backward compatibility with existing invoices)

## Implementation Plan

### Backend Changes (getsentry repo)

#### 1. Invoice Creation Logic

Update the invoice creation flow to populate address fields:

```python
def create_invoice(customer_id: int, invoice_data: dict) -> Invoice:
    # Fetch current billing details
    billing_details = get_billing_details(customer_id)

    # Create invoice with address snapshot
    invoice = Invoice(
        customer_id=customer_id,
        # Copy address fields from billing details
        address_line1=billing_details.address_line1,
        address_line2=billing_details.address_line2,
        city=billing_details.city,
        country_code=billing_details.country_code,
        postal_code=billing_details.postal_code,
        region=billing_details.region,
        # Copy additional context
        company_name=billing_details.company_name,
        tax_number=billing_details.tax_number,
        display_address=billing_details.display_address,
        # ... other invoice fields
        **invoice_data
    )

    invoice.save()
    return invoice
```

#### 2. PDF Rendering Logic

Update PDF rendering to use invoice address:

```python
def render_invoice_pdf(invoice: Invoice) -> bytes:
    # Use address from invoice, not from current billing details
    context = {
        'invoice': invoice,
        'billing_address': {
            'line1': invoice.address_line1,
            'line2': invoice.address_line2,
            'city': invoice.city,
            'country': invoice.country_code,
            'postal_code': invoice.postal_code,
            'region': invoice.region,
            'company_name': invoice.company_name,
        },
        # ... other context
    }

    return generate_pdf('invoice_template.html', context)
```

#### 3. Migration for Existing Invoices

For invoices that were created before this change (with null address fields):

**Option A - Backfill (Recommended):**
```python
def backfill_invoice_addresses():
    """
    One-time script to populate address fields for existing invoices.
    Uses billing details as they are NOW (not perfect but better than nothing).
    """
    invoices = Invoice.objects.filter(address_line1__isnull=True)

    for invoice in invoices:
        billing_details = get_billing_details(invoice.customer_id)
        invoice.address_line1 = billing_details.address_line1
        invoice.address_line2 = billing_details.address_line2
        invoice.city = billing_details.city
        invoice.country_code = billing_details.country_code
        invoice.postal_code = billing_details.postal_code
        invoice.region = billing_details.region
        invoice.save(update_fields=[
            'address_line1', 'address_line2', 'city',
            'country_code', 'postal_code', 'region'
        ])
```

**Option B - Fallback in PDF Rendering:**
```python
def get_invoice_address_for_pdf(invoice: Invoice) -> dict:
    """
    Get address for PDF rendering with fallback to billing details
    for legacy invoices that don't have address populated.
    """
    if invoice.address_line1 or invoice.city:
        # Use invoice address (preferred)
        return {
            'line1': invoice.address_line1,
            'line2': invoice.address_line2,
            'city': invoice.city,
            'country': invoice.country_code,
            'postal_code': invoice.postal_code,
            'region': invoice.region,
        }
    else:
        # Fall back to current billing details (legacy support)
        billing_details = get_billing_details(invoice.customer_id)
        return {
            'line1': billing_details.address_line1,
            'line2': billing_details.address_line2,
            'city': billing_details.city,
            'country': billing_details.country_code,
            'postal_code': billing_details.postal_code,
            'region': billing_details.region,
        }
```

### Testing Requirements

1. **Unit Tests**:
   - Test invoice creation populates address from billing details
   - Test PDF rendering uses invoice address when available
   - Test fallback to billing details for legacy invoices

2. **Integration Tests**:
   - Create invoice, update billing details, verify PDF still shows original address
   - Test with various address scenarios (complete, partial, missing)

3. **Manual Testing**:
   - Create test invoice
   - Update customer billing address
   - Download invoice PDF
   - Verify PDF shows original address, not updated one

## Database Schema

### Required Fields

The Invoice model should have these fields (may already exist):

```python
class Invoice(Model):
    # ... existing fields ...

    # Structured address fields (snapshot from billing details at creation time)
    address_line1 = models.CharField(max_length=255, null=True, blank=True)
    address_line2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    country_code = models.CharField(max_length=2, null=True, blank=True)  # ISO 3166-1 alpha-2
    postal_code = models.CharField(max_length=20, null=True, blank=True)
    region = models.CharField(max_length=100, null=True, blank=True)  # State/Province

    # Additional billing context
    company_name = models.CharField(max_length=255, null=True, blank=True)
    display_address = models.TextField(null=True, blank=True)  # Pre-formatted address string
    # tax_number may already exist
```

### Migration Considerations

- Fields should be nullable to support gradual rollout
- Existing invoices will have null values initially
- PDF rendering must handle null values gracefully

## Rollout Plan

### Phase 1: Add Address Population (Week 1)
- Update invoice creation to populate address fields
- Deploy to staging
- Create test invoices and verify addresses are saved
- Deploy to production
- Monitor for issues

### Phase 2: Update PDF Rendering (Week 2)
- Update PDF rendering to use invoice address with fallback
- Deploy to staging
- Test PDF generation for new and old invoices
- Deploy to production
- Monitor PDF generation metrics

### Phase 3: Backfill Historical Data (Week 3)
- Run backfill script for existing invoices
- Verify data quality
- Remove fallback logic from PDF rendering (optional)

## Success Metrics

- 100% of new invoices have address fields populated
- PDF rendering time unchanged or improved (no extra query for billing details)
- Zero incidents of incorrect addresses on invoices
- Historical invoices maintain address accuracy even after billing detail updates

## Risks and Mitigation

### Risk: Existing code depends on fetching billing details
**Mitigation**: Implement fallback logic, gradual rollout

### Risk: Address format changes over time
**Mitigation**: Store both structured fields and display_address for flexibility

### Risk: Backfill uses current address, not historical
**Mitigation**: Document limitation, prioritize fixing for future invoices

## Related Issues

- Billing Platform modernization initiative
- Invoice immutability requirements
- Compliance with accounting standards (invoices as legal documents)

## References

- TypeScript Invoice type: `static/gsApp/types/index.tsx`
- TypeScript BillingDetails type: `static/gsApp/types/index.tsx`
- Frontend invoice view: `static/gsApp/views/invoiceDetails/`

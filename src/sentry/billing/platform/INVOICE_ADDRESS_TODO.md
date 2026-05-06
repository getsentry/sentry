# Invoice Address Persistence - Implementation Checklist

This checklist outlines the tasks required to implement invoice address persistence across the Sentry and GetSentry codebases.

## Related Documents
- Design: `/src/sentry/billing/platform/INVOICE_ADDRESS_DESIGN.md`
- Linear Issue: REVENG-50

## Backend Tasks (GetSentry Repo)

### Phase 1: Invoice Model
- [ ] Verify Invoice model has address fields:
  - `address_line1` (CharField, nullable)
  - `address_line2` (CharField, nullable)
  - `city` (CharField, nullable)
  - `country_code` (CharField, nullable)
  - `postal_code` (CharField, nullable)
  - `region` (CharField, nullable)
  - `company_name` (CharField, nullable)
  - `display_address` (TextField, nullable)
- [ ] Create migration if fields don't exist
- [ ] Add indexes if needed for reporting queries

### Phase 2: Invoice Creation
- [ ] Locate invoice creation code
- [ ] Update invoice creation to copy address from BillingDetails:
  ```python
  # Pseudocode
  def create_invoice(customer, ...):
      billing_details = customer.get_billing_details()
      invoice = Invoice(
          customer=customer,
          address_line1=billing_details.address_line1,
          address_line2=billing_details.address_line2,
          city=billing_details.city,
          country_code=billing_details.country_code,
          postal_code=billing_details.postal_code,
          region=billing_details.region,
          company_name=billing_details.company_name,
          display_address=billing_details.display_address,
          ...
      )
      return invoice
  ```
- [ ] Add unit tests for address population
- [ ] Test with various address formats (complete, partial, missing)

### Phase 3: PDF Rendering
- [ ] Locate PDF rendering code (likely uses a template)
- [ ] Update PDF template/rendering to use invoice address fields:
  ```python
  # Pseudocode
  def render_invoice_pdf(invoice):
      context = {
          'invoice': invoice,
          'billing_address': {
              'line1': invoice.address_line1,
              'line2': invoice.address_line2,
              'city': invoice.city,
              'country': invoice.country_code,
              'postal_code': invoice.postal_code,
              'region': invoice.region,
              'company': invoice.company_name,
          }
      }
      return render_pdf_from_template('invoice.html', context)
  ```
- [ ] Remove any BillingDetails queries from PDF rendering
- [ ] Add fallback logic for legacy invoices (optional):
  ```python
  def get_address_for_pdf(invoice):
      if invoice.address_line1 or invoice.city:
          return use_invoice_address(invoice)
      else:
          return use_billing_details_address(invoice.customer)
  ```
- [ ] Update PDF tests to verify address source

### Phase 4: Testing
- [ ] **Unit Tests**:
  - [ ] Test invoice creation populates address
  - [ ] Test PDF uses invoice address when present
  - [ ] Test PDF fallback for legacy invoices (if implemented)
  - [ ] Test with null/partial addresses

- [ ] **Integration Tests**:
  - [ ] Create invoice with address A
  - [ ] Update customer billing details to address B
  - [ ] Generate PDF for invoice
  - [ ] Verify PDF shows address A (not B)

- [ ] **Manual Testing**:
  - [ ] Create test customer with billing address
  - [ ] Generate invoice
  - [ ] Verify invoice record has address fields populated
  - [ ] Download PDF, verify address is correct
  - [ ] Update customer billing address
  - [ ] Download same invoice PDF again
  - [ ] Verify PDF still shows original address

### Phase 5: Data Migration
- [ ] Decide on migration strategy:
  - [ ] Option A: Backfill all existing invoices
  - [ ] Option B: Use fallback in PDF rendering
- [ ] If backfilling:
  - [ ] Write backfill script
  - [ ] Test on staging data
  - [ ] Run on production with monitoring
  - [ ] Verify data quality

### Phase 6: Deployment
- [ ] Deploy Phase 1 & 2 (invoice creation) to staging
- [ ] Monitor invoice creation, verify addresses populate
- [ ] Deploy to production
- [ ] Monitor for 24-48 hours
- [ ] Deploy Phase 3 (PDF rendering) to staging
- [ ] Test PDF generation
- [ ] Deploy to production
- [ ] Monitor PDF generation metrics

### Phase 7: Cleanup (Optional)
- [ ] Remove fallback logic from PDF rendering (if using)
- [ ] Add validation to require address on new invoices
- [ ] Update API documentation

## Frontend Tasks (Sentry Repo)

### Documentation
- [x] Add design document
- [x] Update TypeScript types with documentation
- [ ] Update API documentation if needed

### Testing
- [ ] Review existing invoice display tests
- [ ] Ensure tests don't assume address comes from billing details
- [ ] Add tests for invoice detail page showing address

## Monitoring & Validation

### Metrics to Track
- [ ] Invoice creation success rate
- [ ] Percentage of invoices with populated addresses
- [ ] PDF generation success rate
- [ ] PDF generation latency (should improve with fewer queries)

### Alerts
- [ ] Alert if invoice creation fails due to missing address
- [ ] Alert if PDF generation fails
- [ ] Alert if new invoices lack address fields

## Success Criteria

- ✅ 100% of new invoices have address fields populated
- ✅ PDF rendering uses invoice address, not billing details
- ✅ Historical invoice PDFs remain accurate
- ✅ No regression in invoice creation or PDF generation
- ✅ PDF generation performance maintained or improved

## Rollback Plan

If issues arise:
1. **If invoice creation fails**: Revert Phase 2 deployment
2. **If PDF rendering fails**: Revert Phase 3 deployment (fallback should handle gracefully)
3. **If data quality issues**: Pause backfill, investigate, fix

## Notes

- Address fields on Invoice are nullable for backward compatibility
- Legacy invoices may have null address fields
- PDF rendering should handle null values gracefully
- Invoice addresses are snapshots and should never be updated after creation
- This change improves data integrity and legal compliance

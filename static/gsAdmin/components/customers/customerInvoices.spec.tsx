import {OrganizationFixture} from 'sentry-fixture/organization';

import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import CustomerInvoices from 'admin/components/customers/customerInvoices';

describe('CustomerInvoices', () => {
  const mockOrg = OrganizationFixture();
  const orgId = mockOrg.slug;
  const region = 'us';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Invoice Status Display', () => {
    it('displays "Paid" status for paid invoices', async () => {
      const paidInvoice = InvoiceFixture({
        isPaid: true,
        isClosed: false,
        id: 'paid-invoice-1',
        amount: 10000, // $100.00
        stripeInvoiceID: 'in_paid123',
        channel: 'self-serve',
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [paidInvoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        expect(screen.getByText('Paid')).toBeInTheDocument();
      });

      // Verify that invoice status is paid
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });

    it('displays "Closed" status for closed but unpaid invoices', async () => {
      const closedInvoice = InvoiceFixture({
        isPaid: false,
        isClosed: true,
        id: 'closed-invoice-1',
        amount: 5000, // $50.00
        stripeInvoiceID: 'in_closed123',
        channel: 'self-serve',
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [closedInvoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        expect(screen.getByText('Closed')).toBeInTheDocument();
      });

      // Verify that invoice status is closed
      expect(screen.getByText('Closed')).toBeInTheDocument();

      // Should not show Paid or Pending
      expect(screen.queryByText('Paid')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });

    it('displays "Pending" status for open unpaid invoices', async () => {
      const pendingInvoice = InvoiceFixture({
        isPaid: false,
        isClosed: false,
        id: 'pending-invoice-1',
        amount: 7500, // $75.00
        stripeInvoiceID: 'in_pending123',
        channel: 'sales',
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [pendingInvoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });

      // Verify that invoice status is pending
      expect(screen.getByText('Pending')).toBeInTheDocument();

      // Should not show Paid or Closed
      expect(screen.queryByText('Paid')).not.toBeInTheDocument();
      expect(screen.queryByText('Closed')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Invoices with Different States', () => {
    it('displays correct status for each invoice in list', async () => {
      const paidInvoice = InvoiceFixture({
        isPaid: true,
        isClosed: false,
        id: 'paid-1',
        dateCreated: '2024-01-15T00:00:00Z',
        stripeInvoiceID: 'in_paid1',
      });

      const closedInvoice = InvoiceFixture({
        isPaid: false,
        isClosed: true,
        id: 'closed-1',
        dateCreated: '2024-01-10T00:00:00Z',
        stripeInvoiceID: 'in_closed1',
      });

      const pendingInvoice = InvoiceFixture({
        isPaid: false,
        isClosed: false,
        id: 'pending-1',
        dateCreated: '2024-01-05T00:00:00Z',
        stripeInvoiceID: 'in_pending1',
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [paidInvoice, closedInvoice, pendingInvoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        expect(screen.getByText('Paid')).toBeInTheDocument();
      });
      expect(screen.getByText('Closed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('Invoice Display Fields', () => {
    it('displays invoice date, stripe ID, channel, and amount', async () => {
      const invoice = InvoiceFixture({
        id: 'test-invoice',
        dateCreated: '2024-01-15T12:30:00Z',
        stripeInvoiceID: 'in_test123456',
        channel: 'sales',
        amount: 12345, // $123.45
        isPaid: false,
        isClosed: false,
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [invoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      // Wait for date to be displayed (moment format 'll')
      await waitFor(() => {
        expect(screen.getByText(/Jan.*2024/i)).toBeInTheDocument();
      });

      // Check Stripe ID is displayed
      expect(screen.getByText('in_test123456')).toBeInTheDocument();

      // Check channel is displayed
      expect(screen.getByText('sales')).toBeInTheDocument();

      // Check amount is formatted correctly ($123.45)
      expect(screen.getByText(/\$123.45/)).toBeInTheDocument();
    });

    it('displays "n/a" for missing channel', async () => {
      const invoice = InvoiceFixture({
        id: 'test-invoice',
        channel: null,
        isPaid: true,
        isClosed: false,
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [invoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        expect(screen.getByText('n/a')).toBeInTheDocument();
      });
    });

    it('displays refund information for refunded invoices', async () => {
      const refundedInvoice = InvoiceFixture({
        id: 'refunded-invoice',
        amount: 10000, // $100.00
        amountRefunded: 5000, // $50.00 refunded
        isRefunded: true,
        isPaid: true,
        isClosed: false,
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [refundedInvoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        // Check that refund information is displayed (text is split across elements)
        expect(screen.getByText(/refunded/i)).toBeInTheDocument();
      });
    });
  });

  describe('Invoice Links', () => {
    it('links to invoice details page', async () => {
      const invoice = InvoiceFixture({
        id: 'link-test-invoice',
        isPaid: true,
        isClosed: false,
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [invoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        const dateLink = screen.getByRole('link', {
          name: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/,
        });
        expect(dateLink).toHaveAttribute(
          'href',
          `/_admin/customers/${orgId}/invoices/${region}/${invoice.id}/`
        );
      });
    });

    it('links to Stripe dashboard for invoice', async () => {
      const invoice = InvoiceFixture({
        id: 'stripe-link-test',
        stripeInvoiceID: 'in_stripe123',
        isPaid: true,
        isClosed: false,
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [invoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        const stripeLink = screen.getByText('in_stripe123').closest('a');
        expect(stripeLink).toHaveAttribute(
          'href',
          'https://dashboard.stripe.com/invoices/in_stripe123'
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty invoice list', async () => {
      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      // Wait for component to render, then verify empty state
      await waitFor(() => {
        expect(screen.queryByText('Paid')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Closed')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });

    it('handles invoice with zero amount', async () => {
      const zeroInvoice = InvoiceFixture({
        id: 'zero-invoice',
        amount: 0,
        isPaid: true,
        isClosed: false,
      });

      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [zeroInvoice],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      await waitFor(() => {
        expect(screen.getByText('$0')).toBeInTheDocument();
      });
    });
  });

  describe('ResultGrid Integration', () => {
    it('passes correct props to ResultGrid', async () => {
      MockApiClient.addMockResponse({
        url: `/customers/${orgId}/invoices/`,
        body: [],
      });

      render(<CustomerInvoices orgId={orgId} region={region} />);

      // Verify table headers are rendered
      await waitFor(() => {
        expect(screen.getByText('Invoice')).toBeInTheDocument();
      });
      expect(screen.getByText('Stripe ID')).toBeInTheDocument();
      expect(screen.getByText('Channel')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
    });
  });
});

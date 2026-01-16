import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import InvoiceDetails from 'admin/views/invoiceDetails';

describe('InvoiceDetails', () => {
  const mockOrg = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/`,
      body: mockOrg,
    });

    ConfigStore.set(
      'user',
      UserFixture({
        isSuperuser: true,
        permissions: new Set(['billing.admin']),
      })
    );

    ConfigStore.set('regions', [
      {
        name: 'us',
        url: 'https://us.sentry.io',
      },
      {
        name: 'de',
        url: 'https://de.sentry.io',
      },
    ]);
  });

  describe('Close Invoice', () => {
    it('can close invoice', async () => {
      const invoice = InvoiceFixture({isClosed: false});
      MockApiClient.addMockResponse({
        url: `/_admin/cells/us/admin-invoices/${invoice.id}/`,
        body: invoice,
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/_admin/cells/us/invoices/${invoice.id}/close/`,
        method: 'PUT',
        body: InvoiceFixture({isClosed: true}),
        host: 'https://us.sentry.io',
      });

      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${mockOrg.slug}/invoices/us/${invoice.id}/`,
          },
          route: `/organizations/:orgId/invoices/:region/:invoiceId/`,
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Invoices Actions'})
      );
      await userEvent.click(screen.getByText('Close Invoice'));
      renderGlobalModal();

      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(updateMock).toHaveBeenCalled();
    });

    it('cannot close already closed invoice', async () => {
      const invoice = InvoiceFixture({isClosed: true});
      MockApiClient.addMockResponse({
        url: `/_admin/cells/de/admin-invoices/${invoice.id}/`,
        body: invoice,
        host: 'https://de.sentry.io',
      });

      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${mockOrg.slug}/invoices/de/${invoice.id}/`,
          },
          route: `/organizations/:orgId/invoices/:region/:invoiceId/`,
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Invoices Actions'})
      );

      expect(await screen.findByTestId('closeInvoice')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('requires billing admin permission', async () => {
      ConfigStore.set('user', UserFixture({permissions: new Set([])}));

      const invoice = InvoiceFixture({isClosed: false});
      MockApiClient.addMockResponse({
        url: `/_admin/cells/us/admin-invoices/${invoice.id}/`,
        body: invoice,
        host: 'https://us.sentry.io',
      });

      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${mockOrg.slug}/invoices/us/${invoice.id}/`,
          },
          route: `/organizations/:orgId/invoices/:region/:invoiceId/`,
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Invoices Actions'})
      );

      expect(await screen.findByTestId('closeInvoice')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('Retry Payment', () => {
    it('can retry payment', async () => {
      const invoice = InvoiceFixture({isPaid: false});
      MockApiClient.addMockResponse({
        url: `/_admin/cells/us/admin-invoices/${invoice.id}/`,
        body: invoice,
        host: 'https://us.sentry.io',
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/invoices/${invoice.id}/retry-payment/`,
        method: 'PUT',
        body: InvoiceFixture({
          nextChargeAttempt: '2020-11-10T10:29:07.724283Z',
        }),
      });

      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${mockOrg.slug}/invoices/us/${invoice.id}/`,
          },
          route: `/organizations/:orgId/invoices/:region/:invoiceId/`,
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Invoices Actions'})
      );
      await userEvent.click(screen.getByText('Retry Payment'));
      renderGlobalModal();

      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(updateMock).toHaveBeenCalled();
    });

    it('cannot retry already paid invoice', async () => {
      const invoice = InvoiceFixture({isPaid: true});
      MockApiClient.addMockResponse({
        url: `/_admin/cells/us/admin-invoices/${invoice.id}/`,
        body: invoice,
        host: 'https://us.sentry.io',
      });

      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${mockOrg.slug}/invoices/us/${invoice.id}/`,
          },
          route: `/organizations/:orgId/invoices/:region/:invoiceId/`,
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Invoices Actions'})
      );

      expect(await screen.findByTestId('retryPayment')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });
});

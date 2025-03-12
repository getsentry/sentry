import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import InvoiceDetails from 'admin/views/invoiceDetails';

describe('InvoiceDetails', function () {
  const mockOrg = OrganizationFixture();

  beforeEach(function () {
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

  describe('Close Invoice', function () {
    it('can close invoice', async function () {
      const invoice = InvoiceFixture({isClosed: false});
      MockApiClient.addMockResponse({
        url: `/_admin/invoices/${invoice.id}/`,
        body: invoice,
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/invoices/${invoice.id}/close/`,
        method: 'PUT',
        body: InvoiceFixture({isClosed: true}),
      });

      const {router} = initializeOrg({
        router: {
          params: {
            orgId: mockOrg.slug,
            invoiceId: invoice.id,
            region: 'us',
          },
        },
      });

      render(<InvoiceDetails />, {router});

      expect(
        await screen.findAllByRole('button', {name: 'Invoices Actions'})
      ).toHaveLength(2);

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Invoices Actions'})[0]!
      );
      await userEvent.click(screen.getByTestId('action-closeInvoice'));
      renderGlobalModal();

      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(updateMock).toHaveBeenCalled();
    });

    it('cannot close already closed invoice', async function () {
      const invoice = InvoiceFixture({isClosed: true});
      MockApiClient.addMockResponse({
        url: `/_admin/invoices/${invoice.id}/`,
        body: invoice,
        host: 'https://de.sentry.io',
      });

      const {router} = initializeOrg({
        router: {
          params: {
            orgId: mockOrg.slug,
            invoiceId: invoice.id,
            region: 'de',
          },
        },
      });

      render(<InvoiceDetails />, {router});

      expect(
        await screen.findAllByRole('button', {name: 'Invoices Actions'})
      ).toHaveLength(2);

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Invoices Actions'})[0]!
      );

      expect(screen.getByTestId('action-closeInvoice')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('requires billing admin permission', async function () {
      ConfigStore.set('user', UserFixture({permissions: new Set([])}));

      const invoice = InvoiceFixture({isClosed: false});
      MockApiClient.addMockResponse({
        url: `/_admin/invoices/${invoice.id}/`,
        body: invoice,
        host: 'https://us.sentry.io',
      });

      const {router} = initializeOrg({
        router: {
          params: {
            orgId: mockOrg.slug,
            invoiceId: invoice.id,
            region: 'us',
          },
        },
      });

      render(<InvoiceDetails />, {router});

      expect(
        await screen.findAllByRole('button', {name: 'Invoices Actions'})
      ).toHaveLength(2);

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Invoices Actions'})[0]!
      );

      expect(screen.getByTestId('action-closeInvoice')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('Retry Payment', function () {
    it('can retry payment', async function () {
      const invoice = InvoiceFixture({isPaid: false});
      MockApiClient.addMockResponse({
        url: `/_admin/invoices/${invoice.id}/`,
        body: invoice,
        host: 'https://us.sentry.io',
      });

      const {router} = initializeOrg({
        router: {
          params: {
            orgId: mockOrg.slug,
            invoiceId: invoice.id,
            region: 'us',
          },
        },
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/invoices/${invoice.id}/retry-payment/`,
        method: 'PUT',
        body: InvoiceFixture({
          nextChargeAttempt: '2020-11-10T10:29:07.724283Z',
        }),
      });

      render(<InvoiceDetails />, {router});

      expect(
        await screen.findAllByRole('button', {name: 'Invoices Actions'})
      ).toHaveLength(2);

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Invoices Actions'})[0]!
      );
      await userEvent.click(screen.getByTestId('action-retryPayment'));
      renderGlobalModal();

      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(updateMock).toHaveBeenCalled();
    });

    it('cannot retry already paid invoice', async function () {
      const invoice = InvoiceFixture({isPaid: true});
      MockApiClient.addMockResponse({
        url: `/_admin/invoices/${invoice.id}/`,
        body: invoice,
        host: 'https://us.sentry.io',
      });

      const {router} = initializeOrg({
        router: {
          params: {
            orgId: mockOrg.slug,
            invoiceId: invoice.id,
            region: 'us',
          },
        },
      });

      render(<InvoiceDetails />, {router});

      expect(
        await screen.findAllByRole('button', {name: 'Invoices Actions'})
      ).toHaveLength(2);

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Invoices Actions'})[0]!
      );

      expect(screen.getByTestId('action-retryPayment')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });
});

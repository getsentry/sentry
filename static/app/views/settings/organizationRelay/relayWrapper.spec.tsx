import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {RelayWrapper} from 'sentry/views/settings/organizationRelay/relayWrapper';

describe('RelayWrapper', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function renderComponent(
    organizationProps: Parameters<typeof OrganizationFixture>[0] = {}
  ) {
    const organization = OrganizationFixture({
      trustedRelays: [],
      ...organizationProps,
    });
    return render(
      <Fragment>
        <GlobalModal />
        <RelayWrapper />
      </Fragment>,
      {organization}
    );
  }

  describe('ingestThroughTrustedRelaysOnly toggle', () => {
    it('renders the toggle', async () => {
      renderComponent();

      expect(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      ).toBeInTheDocument();
      expect(screen.getByText('Data Authenticity')).toBeInTheDocument();
    });

    it('toggle is unchecked when ingestThroughTrustedRelaysOnly is disabled', async () => {
      renderComponent({
        ingestThroughTrustedRelaysOnly: 'disabled',
      });

      expect(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      ).not.toBeChecked();
    });

    it('toggle is checked when ingestThroughTrustedRelaysOnly is enabled', async () => {
      renderComponent({
        ingestThroughTrustedRelaysOnly: 'enabled',
      });

      expect(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      ).toBeChecked();
    });

    it('enabling shows a confirm modal and sends enabled to the API on confirm', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
      });

      renderComponent({
        ingestThroughTrustedRelaysOnly: 'disabled',
      });

      await userEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      );

      expect(
        screen.getByText(
          'Enabling this can lead to data being rejected for ALL projects, are you sure you want to continue?'
        )
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(mock).toHaveBeenCalledWith(
        '/organizations/org-slug/',
        expect.objectContaining({
          method: 'PUT',
          data: {ingestThroughTrustedRelaysOnly: 'enabled'},
        })
      );
    });

    it('canceling the confirm modal reverts the toggle and does not call the API', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
      });

      renderComponent({
        ingestThroughTrustedRelaysOnly: 'disabled',
      });

      await userEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      );

      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      expect(mock).not.toHaveBeenCalled();
      expect(
        screen.getByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      ).not.toBeChecked();
    });

    it('disabling does not show a confirm modal and sends disabled to the API', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
      });

      renderComponent({
        ingestThroughTrustedRelaysOnly: 'enabled',
      });

      await userEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      );

      expect(screen.queryByRole('button', {name: 'Confirm'})).not.toBeInTheDocument();

      expect(mock).toHaveBeenCalledWith(
        '/organizations/org-slug/',
        expect.objectContaining({
          method: 'PUT',
          data: {ingestThroughTrustedRelaysOnly: 'disabled'},
        })
      );
    });

    it('reverts to unchecked if enabling fails', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        statusCode: 500,
      });

      renderComponent({
        ingestThroughTrustedRelaysOnly: 'disabled',
      });

      await userEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      ).not.toBeChecked();

      consoleErrorSpy.mockRestore();
    });

    it('toggle is disabled when user lacks org:write permission', async () => {
      renderComponent({
        access: [],
      });

      expect(
        await screen.findByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      ).toBeDisabled();
    });
  });
});

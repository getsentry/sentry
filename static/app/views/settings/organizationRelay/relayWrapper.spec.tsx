import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
    it('does not render the Data Authenticity section', () => {
      renderComponent();

      expect(screen.queryByText('Data Authenticity')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', {
          name: 'Ingest Through Trusted Relays Only',
        })
      ).not.toBeInTheDocument();
    });
  });
});

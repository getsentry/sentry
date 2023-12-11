import selectEvent from 'react-select-event';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModuleName} from 'sentry/views/starfish/types';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';

jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/usePageFilters');

describe('DomainSelector', function () {
  const organization = Organization();
  jest.mocked(useOrganization).mockReturnValue(organization);

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [],
    },
  });

  it('allows selecting a domain', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'count()': 10,
            'span.domain': 'sentry_user',
          },
          {
            'count()': 9,
            'span.domain': 'sentry_organization',
          },
        ],
      },
    });

    render(<DomainSelector moduleName={ModuleName.DB} />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    await selectEvent.openMenu(screen.getByText('All'));

    expect(screen.getByText('sentry_user')).toBeInTheDocument();
    expect(screen.getByText('sentry_organization')).toBeInTheDocument();
  });
});

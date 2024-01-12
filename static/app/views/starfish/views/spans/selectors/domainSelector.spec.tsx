import selectEvent from 'react-select-event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModuleName} from 'sentry/views/starfish/types';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';

jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/usePageFilters');

describe('DomainSelector', function () {
  const organization = OrganizationFixture();
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

  beforeEach(function () {
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
      headers: {
        Link: '<previous-data>; rel="previous"; results="false"; cursor="0:0:1", <next-data>; rel="next"; results="true"; cursor="0:100:0"',
      },
      match: [MockApiClient.matchQuery({query: 'has:span.description span.module:db'})],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('allows selecting a domain', async function () {
    render(<DomainSelector moduleName={ModuleName.DB} />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    await selectEvent.openMenu(screen.getByText('All'));

    expect(screen.getByText('sentry_user')).toBeInTheDocument();
    expect(screen.getByText('sentry_organization')).toBeInTheDocument();
  });

  it('fetches more domains if available', async function () {
    const fetchMoreResponse = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'count()': 3,
            'span.domain': 'pg_data',
          },
        ],
      },
      match: [
        MockApiClient.matchQuery({
          query: 'has:span.description span.module:db span.domain:*p*',
        }),
      ],
    });

    render(<DomainSelector moduleName={ModuleName.DB} />);
    expect(fetchMoreResponse).not.toHaveBeenCalled();

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    await selectEvent.openMenu(screen.getByText('All'));

    await userEvent.type(screen.getByRole('textbox'), 'p');

    await waitFor(() => {
      expect(fetchMoreResponse).toHaveBeenCalled();
    });

    await tick();

    expect(screen.getByText('pg_data')).toBeInTheDocument();
    expect(screen.queryByText('sentry_user')).not.toBeInTheDocument();
    expect(screen.queryByText('sentry_organization')).not.toBeInTheDocument();

    userEvent.clear(screen.getByRole('textbox'));

    expect(screen.getByText('pg_data')).toBeInTheDocument();
    expect(screen.getByText('sentry_user')).toBeInTheDocument();
    expect(screen.getByText('sentry_organization')).toBeInTheDocument();
  });
});

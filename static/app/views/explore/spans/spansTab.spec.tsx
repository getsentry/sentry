import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FieldKind} from 'sentry/utils/fields';
import * as spanTagsModule from 'sentry/views/explore/contexts/spanTagsContext';
import {SpansTabContent} from 'sentry/views/explore/spans/spansTab';

jest.mock('sentry/utils/analytics');

const mockStringTags: TagCollection = {
  stringTag1: {
    key: 'stringTag1',
    kind: FieldKind.TAG,
    name: 'stringTag1',
  },
  stringTag2: {
    key: 'stringTag2',
    kind: FieldKind.TAG,
    name: 'stringTag2',
  },
};

const mockNumberTags: TagCollection = {
  numberTag1: {
    key: 'numberTag1',
    kind: FieldKind.MEASUREMENT,
    name: 'numberTag1',
  },
  numberTag2: {
    key: 'numberTag2',
    kind: FieldKind.MEASUREMENT,
    name: 'numberTag2',
  },
};

describe('SpansTabContent', function () {
  const {organization, project, router} = initializeOrg({
    organization: {
      features: ['visibility-explore-rpc'],
    },
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {
          period: '7d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      method: 'GET',
      body: {},
    });
  });

  it('should fire analytics once per change', async function () {
    render(
      <SpansTabContent
        defaultPeriod="7d"
        maxPickableDays={7}
        relativeOptions={{
          '1h': 'Last hour',
          '24h': 'Last 24 hours',
          '7d': 'Last 7 days',
        }}
      />,
      {disableRouterMocks: true, router, organization}
    );

    await screen.findByText(/No spans found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({
        result_mode: 'span samples',
      })
    );

    (trackAnalytics as jest.Mock).mockClear();
    await userEvent.click(await screen.findByText('Trace Samples'));

    await screen.findByText(/No trace results found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({
        result_mode: 'trace samples',
      })
    );

    (trackAnalytics as jest.Mock).mockClear();
    await userEvent.click(
      within(screen.getByTestId('section-mode')).getByRole('radio', {name: 'Aggregates'})
    );

    await screen.findByText(/No spans found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({
        result_mode: 'aggregates',
      })
    );
  });

  it('should show hints when the feature flag is enabled', function () {
    jest.spyOn(spanTagsModule, 'useSpanTags').mockImplementation(type => {
      switch (type) {
        case 'number':
          return mockNumberTags;
        case 'string':
          return mockStringTags;
        default:
          return {};
      }
    });

    const {organization: schemaHintsOrganization} = initializeOrg({
      organization: {
        ...organization,
        features: ['traces-schema-hints'],
      },
    });

    render(
      <SpansTabContent
        defaultPeriod="7d"
        maxPickableDays={7}
        relativeOptions={{
          '1h': 'Last hour',
          '24h': 'Last 24 hours',
          '7d': 'Last 7 days',
        }}
      />,
      {disableRouterMocks: true, router, organization: schemaHintsOrganization}
    );

    expect(screen.getByText('stringTag1 is ...')).toBeInTheDocument();
    expect(screen.getByText('stringTag2 is ...')).toBeInTheDocument();
    expect(screen.getByText('numberTag1 is ...')).toBeInTheDocument();
    expect(screen.getByText('numberTag2 is ...')).toBeInTheDocument();
  });
});

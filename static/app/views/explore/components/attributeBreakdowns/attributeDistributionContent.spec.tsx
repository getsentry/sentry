import type {ReactNode} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

import {AttributeDistribution} from './attributeDistributionContent';

jest.mock('echarts-for-react/lib/core', () => {
  return jest.fn(({style}) => {
    return <div style={{...style, background: 'green'}}>echarts mock</div>;
  });
});

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

function makeAttributeDistributions(start: number, end: number) {
  return Object.fromEntries(
    Array.from({length: end - start + 1}, (_value, index) => {
      const attributeNumber = start + index;
      return [
        `attribute.${attributeNumber}`,
        [{label: `value ${attributeNumber}`, value: attributeNumber}],
      ];
    })
  );
}

function makeStatsResponse(
  attributes: Record<string, Array<{label: string; value: number}>>
) {
  return {
    data: [
      {
        attribute_distributions: {
          data: attributes,
        },
      },
    ],
  };
}

describe('AttributeDistribution', () => {
  const {organization, project} = initializeOrg();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('fetches the first page at visible page size and uses the API cursor for the next page', async () => {
    const firstPageRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/stats/`,
      method: 'GET',
      body: makeStatsResponse(makeAttributeDistributions(1, 12)),
      headers: {
        Link: '<https://sentry.io>; rel="next"; results="true"; cursor="cursor-12"',
      },
      match: [
        (_url: string, options: {query?: Record<string, any>}) =>
          options.query?.cursor === undefined,
      ],
    });
    const secondPageRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/stats/`,
      method: 'GET',
      body: makeStatsResponse(makeAttributeDistributions(13, 24)),
      headers: {
        Link: '<https://sentry.io>; rel="next"; results="false"; cursor="cursor-24"',
      },
      match: [
        (_url: string, options: {query?: Record<string, any>}) =>
          options.query?.cursor === 'cursor-12',
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [{'count()': 100}]},
    });

    render(<AttributeDistribution />, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/traces/`,
          query: {
            project: project.id,
            statsPeriod: '14d',
          },
        },
        route: '/organizations/:orgId/explore/traces/',
      },
    });

    expect(await screen.findByText('attribute.1')).toBeInTheDocument();
    expect(firstPageRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/stats/`,
      expect.objectContaining({
        query: expect.objectContaining({
          limit: 12,
        }),
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await waitFor(() => {
      expect(secondPageRequest).toHaveBeenCalledTimes(1);
    });
    expect(secondPageRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/stats/`,
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: 'cursor-12',
        }),
      })
    );
    expect(await screen.findByText('attribute.13')).toBeInTheDocument();
    expect(screen.queryByText('attribute.1')).not.toBeInTheDocument();
    expect(firstPageRequest).toHaveBeenCalledTimes(1);
  });
});

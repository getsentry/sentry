import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import type {PageFilters} from 'sentry/types/core';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import ProjectBaseEventsChart from 'sentry/views/projectDetail/charts/projectBaseEventsChart';

describe('ProjectBaseEventsChart', () => {
  let mockApi: jest.Mock;
  const organization = OrganizationFixture();

  const baseSelection: PageFilters = {
    projects: [1, 2],
    environments: ['prod'],
    datetime: {
      period: '14d',
      start: new Date(2021, 0, 28, 12, 13, 14),
      end: new Date(2021, 0, 28, 23, 59, 59),
      utc: null,
    },
  };

  const defaultProps = {
    api: new MockApiClient(),
    organization,
    selection: baseSelection,
    title: 'Test Chart',
    yAxis: 'count()',
    query: '',
    field: ['count()'],
    dataset: DiscoverDatasets.METRICS_ENHANCED,
    onTotalValuesChange: jest.fn(),
    location: {
      pathname: '/test',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH' as const,
      key: 'test',
    },
  };

  beforeEach(() => {
    mockApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-meta/`,
      body: {count: 100},
    });

    // Mock the events-stats endpoint for the EventsChart component
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {data: []},
    });

    // Mock the releases/stats endpoint
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls fetchTotalCount on mount', async () => {
    render(<ProjectBaseEventsChart {...defaultProps} />, {
      organization,
    });

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
    });

    expect(mockApi).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-meta/`,
      expect.objectContaining({
        query: expect.objectContaining({
          project: ['1', '2'],
          environment: ['prod'],
        }),
      })
    );
  });

  it.each([
    {
      name: 'projects change',
      getChangedSelection: () => ({...baseSelection, projects: [1]}),
    },
    {
      name: 'environments change',
      getChangedSelection: () => ({...baseSelection, environments: ['staging']}),
    },
    {
      name: 'period changes',
      getChangedSelection: () => ({
        ...baseSelection,
        datetime: {...baseSelection.datetime, period: '7d'},
      }),
    },
    {
      name: 'start date changes',
      getChangedSelection: () => ({
        ...baseSelection,
        datetime: {...baseSelection.datetime, start: new Date(2021, 0, 27, 12, 13, 14)},
      }),
    },
    {
      name: 'end date changes',
      getChangedSelection: () => ({
        ...baseSelection,
        datetime: {...baseSelection.datetime, end: new Date(2021, 0, 29, 23, 59, 59)},
      }),
    },
  ])('calls fetchTotalCount when $name', async ({getChangedSelection}) => {
    const {rerender} = render(<ProjectBaseEventsChart {...defaultProps} />, {
      organization,
    });

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
    });

    const changedSelection = getChangedSelection();

    rerender(<ProjectBaseEventsChart {...defaultProps} selection={changedSelection} />);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(2);
    });
  });

  it.each([
    {
      name: 'only utc changes',
      getChangedSelection: () => ({
        ...baseSelection,
        datetime: {...baseSelection.datetime, utc: true},
      }),
    },
    {
      name: 'dates have same value but different object identity',
      getChangedSelection: () => ({
        ...baseSelection,
        datetime: {
          ...baseSelection.datetime,
          start: new Date(2021, 0, 28, 12, 13, 14), // Same value, different object
          end: new Date(2021, 0, 28, 23, 59, 59), // Same value, different object
        },
      }),
    },
  ])('does not call fetchTotalCount when $name', async ({getChangedSelection}) => {
    const {rerender} = render(<ProjectBaseEventsChart {...defaultProps} />, {
      organization,
    });

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
    });

    const changedSelection = getChangedSelection();

    rerender(<ProjectBaseEventsChart {...defaultProps} selection={changedSelection} />);

    // Wait a bit to ensure no additional calls are made
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it('calls onTotalValuesChange with the count on success', async () => {
    const onTotalValuesChange = jest.fn();

    render(
      <ProjectBaseEventsChart
        {...defaultProps}
        onTotalValuesChange={onTotalValuesChange}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(onTotalValuesChange).toHaveBeenCalledWith(100);
    });
  });

  it('calls onTotalValuesChange with null on error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-meta/`,
      statusCode: 500,
    });

    const onTotalValuesChange = jest.fn();

    render(
      <ProjectBaseEventsChart
        {...defaultProps}
        onTotalValuesChange={onTotalValuesChange}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(onTotalValuesChange).toHaveBeenCalledWith(null);
    });
  });

  it('calls fetchTotalCount with correct parameters', async () => {
    const customSelection: PageFilters = {
      projects: [3],
      environments: ['dev', 'staging'],
      datetime: {
        period: '7d',
        start: null,
        end: null,
        utc: false,
      },
    };

    render(
      <ProjectBaseEventsChart
        {...defaultProps}
        selection={customSelection}
        query="transaction.duration:>100"
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-meta/`,
        expect.objectContaining({
          query: expect.objectContaining({
            project: ['3'],
            environment: ['dev', 'staging'],
            query: 'transaction.duration:>100',
            statsPeriod: '7d',
          }),
        })
      );
    });
  });
});

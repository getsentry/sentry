import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {AppStartScreens} from 'sentry/views/insights/mobile/appStarts/components/tables/screensTable';

jest.mock('sentry/views/insights/common/queries/useReleases');

jest.mocked(useReleaseSelection).mockReturnValue({
  primaryRelease: 'com.example.vu.android@2.10.5',
  isLoading: false,
  secondaryRelease: 'com.example.vu.android@2.10.3+42',
});

function getMockEventView({fields}: {fields: any}) {
  return new EventView({
    id: '1',
    name: 'mock query',
    fields,

    sorts: [],
    query: '',
    project: [],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: [],
    additionalConditions: new MutableSearch(''),
    createdBy: undefined,
    interval: undefined,
    display: '',
    team: [],
    topEvents: undefined,
    yAxis: undefined,
  });
}

describe('AppStartScreens', () => {
  it('renders the correct headers', () => {
    render(
      <AppStartScreens
        data={{
          data: [],
          meta: {
            fields: [],
          },
        }}
        eventView={getMockEventView({fields: []})}
        isLoading={false}
        pageLinks={undefined}
      />
    );

    expect(screen.getByRole('columnheader', {name: 'Screen'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Avg Cold Start (R1)'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Avg Cold Start (R2)'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Change'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Type Breakdown'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Cold Start Count'})
    ).toBeInTheDocument();
  });

  it('renders custom transaction and breakdown fields', () => {
    render(
      <AppStartScreens
        data={{
          data: [
            {
              id: '1',
              transaction: 'Screen 1',
              'avg_if(measurements.app_start_cold,release,com.example.vu.android@2.10.5)': 100,
              'avg_if(measurements.app_start_cold,release,com.example.vu.android@2.10.3+42)': 200,
              'avg_compare(measurements.app_start_cold,release,com.example.vu.android@2.10.5,com.example.vu.android@2.10.3+42)': 50,
              app_start_breakdown: 'breakdown',
              'count_starts(measurements.app_start_cold)': 10,
            },
          ],
          meta: {
            fields: [],
          },
        }}
        eventView={getMockEventView({fields: []})}
        isLoading={false}
        pageLinks={undefined}
      />
    );

    expect(screen.getByRole('link', {name: 'Screen 1'})).toBeInTheDocument();
    expect(screen.getByTestId('app-start-breakdown')).toBeInTheDocument();
  });
});

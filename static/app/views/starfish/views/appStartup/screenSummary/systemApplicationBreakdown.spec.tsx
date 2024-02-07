import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import SystemApplicationBreakdown from 'sentry/views/starfish/views/appStartup/screenSummary/systemApplicationBreakdown';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('SystemApplicationBreakdown', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  beforeEach(function () {
    jest.mocked(useLocation).mockReturnValue({
      action: 'PUSH',
      hash: '',
      key: '',
      pathname: '/organizations/org-slug/performance/mobile/screens/spans/',
      query: {
        project: project.id,
        transaction: 'MainActivity',
        primaryRelease: 'com.example.vu.android@2.10.5',
        secondaryRelease: 'com.example.vu.android@2.10.3+42',
      },
      search: '',
      state: undefined,
    } as Location);

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
        projects: [parseInt(project.id, 10)],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        {
          id: 970136705,
          version: 'com.example.vu.android@2.10.5',
          dateCreated: '2023-12-19T21:37:53.895495Z',
        },
        {
          id: 969902997,
          version: 'com.example.vu.android@2.10.3+42',
          dateCreated: '2023-12-19T18:04:06.953025Z',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            release: 'com.example.vu.android@2.10.5',
            'span.description': 'io.sentry.samples.android.ContentProvider.onStart',
            'span.op': 'contentprovider.load',
            'sum(span.self_time)': 10,
          },
          {
            release: 'com.example.vu.android@2.10.5',
            'span.description': '',
            'span.op': 'activity.load',
            'sum(span.self_time)': 10,
          },
          {
            release: 'com.example.vu.android@2.10.5',
            'span.description': 'Initial Frame Render',
            'span.op': 'app.warm.start',
            'sum(span.self_time)': 10,
          },
          {
            release: 'com.example.vu.android@2.10.5',
            'span.description': 'Runtime Init to Pre Main Initializers',
            'span.op': 'app.warm.start',
            'sum(span.self_time)': 70,
          },
          {
            release: 'com.example.vu.android@2.10.3+42',
            'span.description': 'Runtime Init to Pre Main Initializers',
            'span.op': 'app.warm.start',
            'sum(span.self_time)': 70,
          },
        ],
      },
    });
  });

  it('aggregates spans data into system and application', async function () {
    render(<SystemApplicationBreakdown additionalFilters={[]} />);

    await userEvent.hover(await screen.findByTestId('primary-release-breakdown'));
    expect(await screen.findByTestId('breakdown-tooltip-content')).toHaveTextContent(
      'System7070%Application3030%'
    );

    await userEvent.unhover(screen.getByTestId('primary-release-breakdown'));
    await waitFor(() => {
      expect(screen.queryByTestId('breakdown-tooltip-content')).not.toBeInTheDocument();
    });

    await userEvent.hover(screen.getByTestId('secondary-release-breakdown'));
    expect(await screen.findByTestId('breakdown-tooltip-content')).toHaveTextContent(
      'System70100%Application00%'
    );
  });
});

import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {OurlogsSection} from 'sentry/components/events/ourlogs/ourlogsSection';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const TRACE_ID = '00000000000000000000000000000000';

jest.mock('@tanstack/react-virtual', () => {
  return {
    useWindowVirtualizer: jest.fn().mockReturnValue({
      getVirtualItems: jest.fn().mockReturnValue([
        {key: '1', index: 0, start: 0, end: 50, lane: 0},
        {key: '2', index: 1, start: 50, end: 100, lane: 0},
        {key: '3', index: 2, start: 100, end: 150, lane: 0},
      ]),
      getTotalSize: jest.fn().mockReturnValue(150),
      scrollToIndex: jest.fn(),
      options: {
        scrollMargin: 0,
      },
      scrollDirection: 'forward',
      scrollOffset: 0,
      isScrolling: false,
    }),
    useVirtualizer: jest.fn().mockReturnValue({
      getVirtualItems: jest.fn().mockReturnValue([
        {key: '1', index: 0, start: 0, end: 50, lane: 0},
        {key: '2', index: 1, start: 50, end: 100, lane: 0},
        {key: '3', index: 2, start: 100, end: 150, lane: 0},
      ]),
      getTotalSize: jest.fn().mockReturnValue(150),
      scrollToIndex: jest.fn(),
      options: {
        scrollMargin: 0,
      },
      scrollDirection: 'forward',
      scrollOffset: 0,
      isScrolling: false,
    }),
  };
});

const organization = OrganizationFixture({
  features: ['ourlogs-enabled'],
});
const project = ProjectFixture();
const group = GroupFixture();
const event = EventFixture({
  size: 1,
  dateCreated: '2019-03-20T00:00:00.000Z',
  errors: [],
  entries: [],
  tags: [
    {key: 'environment', value: 'dev'},
    {key: 'mechanism', value: 'ANR'},
  ],
  contexts: {
    app: {
      app_start_time: '2021-08-31T15:14:21Z',
      device_app_hash: '0b77c3f2567d65fe816e1fa7013779fbe3b51633',
      build_type: 'test',
      app_identifier: 'io.sentry.sample.iOS-Swift',
      app_name: 'iOS-Swift',
      app_version: '7.2.3',
      app_build: '390',
      app_id: 'B2690307-FDD1-3D34-AA1E-E280A9C2406C',
      type: 'app',
    },
    device: {
      family: 'iOS',
      model: 'iPhone13,4',
      model_id: 'D54pAP',
      memory_size: 5987008512,
      free_memory: 154435584,
      usable_memory: 4706893824,
      storage_size: 127881465856,
      boot_time: '2021-08-29T06:05:51Z',
      timezone: 'CEST',
      type: 'device',
    },
    os: {
      name: 'iOS',
      version: '14.7.1',
      build: '18G82',
      kernel_version:
        'Darwin Kernel Version 20.6.0: Mon Jun 21 21:23:35 PDT 2021; root:xnu-7195.140.42~10/RELEASE_ARM64_T8101',
      rooted: false,
      type: 'os',
    },
    trace: {
      trace_id: TRACE_ID,
      span_id: 'b0e6f15b45c36b12',
      op: 'ui.action.click',
      type: 'trace',
    },
  },
});

describe('OurlogsSection', () => {
  let logId: string;
  let mockRequest: jest.Mock;
  beforeEach(() => {
    logId = '11111111111111111111111111111111';

    ProjectsStore.loadInitialData([project]);

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/`,
      body: [project],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [
          LogFixture({
            [OurLogKnownFieldKey.ID]: logId,
            [OurLogKnownFieldKey.PROJECT_ID]: project.id,
            [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
            [OurLogKnownFieldKey.TRACE_ID]: TRACE_ID,
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 0,
            [OurLogKnownFieldKey.MESSAGE]: 'i am a log',
          }),
        ],
        meta: {},
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${logId}/`,
      method: 'GET',
      body: {
        itemId: logId,
        timestamp: '2025-04-03T15:50:10+00:00',
        attributes: [
          {name: 'severity', type: 'str', value: 'error'},
          {name: 'special_field', type: 'str', value: 'special value'},
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  it('renders empty', () => {
    const mockRequestEmpty = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [],
        meta: {},
      },
    });
    render(<OurlogsSection event={event} project={project} group={group} />, {
      organization,
    });
    expect(mockRequestEmpty).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Logs/)).not.toBeInTheDocument();
  });

  it('renders logs', async () => {
    const mockRowDetailsRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${logId}/`,
      method: 'GET',
      body: {
        itemId: logId,
        timestamp: '2025-04-03T15:50:10+00:00',
        attributes: [
          {name: 'severity', type: 'str', value: 'error'},
          {name: 'special_field', type: 'str', value: 'special value'},
        ],
      },
    });

    render(<OurlogsSection event={event} project={project} group={group} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
          query: {
            project: project.id,
          },
        },
      },
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/i am a log/)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('complementary', {name: 'logs drawer'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(/i am a log/));

    const aside = screen.getByRole('complementary', {name: 'logs drawer'});
    expect(aside).toBeInTheDocument();

    await waitFor(() => {
      expect(mockRowDetailsRequest).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(within(aside).getByText(/special value/)).toBeInTheDocument();
    });

    expect(within(aside).getByTestId('tree-key-severity')).toBeInTheDocument();
    expect(within(aside).getByTestId('tree-key-severity')).toHaveTextContent('severity');
  });

  it('renders Open in explore button with correct URL when trace_id exists', async () => {
    render(<OurlogsSection event={event} project={project} group={group} />, {
      organization: OrganizationFixture({
        features: ['ourlogs-enabled', 'visibility-explore-view'],
      }),
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
          query: {
            project: project.id,
          },
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/i am a log/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/i am a log/));

    const aside = screen.getByRole('complementary', {name: 'logs drawer'});
    expect(aside).toBeInTheDocument();

    const openInExploreButton = within(aside).getByRole('button', {
      name: 'Open in explore',
    });
    expect(openInExploreButton).toBeInTheDocument();
    expect(openInExploreButton).toHaveAttribute('target', '_blank');

    const href = openInExploreButton.getAttribute('href');
    expect(href).toBe(
      '/organizations/org-slug/explore/logs/?end=2019-03-21T00%3A00%3A00&environment=dev&logsQuery=trace%3A00000000000000000000000000000000&project=2&start=2019-03-19T00%3A00%3A00'
    );
  });
});

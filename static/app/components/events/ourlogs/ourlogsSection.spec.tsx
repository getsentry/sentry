import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {OurlogsSection} from 'sentry/components/events/ourlogs/ourlogsSection';

const TRACE_ID = '00000000000000000000000000000000';

const organization = OrganizationFixture({features: ['ourlogs-enabled']});
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

describe('OurlogsSection', function () {
  beforeEach(function () {
    // the search query combobox is firing updates and causing console.errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders empty', function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [],
        meta: {},
      },
    });
    render(<OurlogsSection event={event} project={project} group={group} />, {
      organization,
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Logs/)).not.toBeInTheDocument();
  });

  it('renders logs', async function () {
    const now = new Date();
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-logs/`,
      body: {
        data: [
          {
            'sentry.item_id': '11111111111111111111111111111111',
            'project.id': 1,
            trace: TRACE_ID,
            severity_number: 0,
            severity: 'info',
            timestamp: now.toISOString(),
            'tags[sentry.timestamp_precise,number]': now.getTime() * 1e6,
            message: 'i am a log',
          },
        ],
        meta: {},
      },
    });
    render(<OurlogsSection event={event} project={project} group={group} />, {
      organization,
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);

    // without waiting a few ticks, the test fails just before the
    // promise corresponding to the request resolves
    // by adding some ticks, it forces the test to wait a little longer
    // until the promise is resolved
    for (let i = 0; i < 10; i++) {
      await tick();
    }

    expect(screen.getByText(/i am a log/)).toBeInTheDocument();

    expect(
      screen.queryByRole('complementary', {name: 'logs drawer'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(/i am a log/));

    const aside = screen.getByRole('complementary', {name: 'logs drawer'});
    expect(aside).toBeInTheDocument();

    expect(within(aside).getByText(/i am a log/)).toBeInTheDocument();
  });
});

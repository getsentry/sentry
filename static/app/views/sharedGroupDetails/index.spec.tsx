import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SharedGroupDetails from 'sentry/views/sharedGroupDetails';

describe('SharedGroupDetails', () => {
  const eventEntry = EventEntryFixture();
  const exception = EventStacktraceExceptionFixture().entries[0];

  const organization = OrganizationFixture({slug: 'test-org'});
  const project = ProjectFixture({organization});

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/shared/issues/a/`,
      body: GroupFixture({
        title: 'ZeroDivisionError',
        latestEvent: EventFixture({
          entries: [eventEntry, exception],
        }),
        project,
      }),
    });
    MockApiClient.addMockResponse({
      url: '/shared/issues/a/',
      body: GroupFixture({
        title: 'ZeroDivisionError',
        latestEvent: EventFixture({
          entries: [eventEntry, exception],
        }),
        project,
      }),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/events/1/actionable-items/`,
      body: {
        errors: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/events/1/committers/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', async () => {
    render(<SharedGroupDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/share/issue/a/`,
        },
        route: '/organizations/:orgId/share/issue/:shareId/',
      },
    });
    expect(await screen.findByText('Details')).toBeInTheDocument();
    expect(await screen.findByTestId('sgh-timestamp')).toBeInTheDocument();
  });
});

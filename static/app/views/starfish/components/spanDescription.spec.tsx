import {Organization} from 'sentry-fixture/organization';
import {Project} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EntryType} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DatabaseSpanDescription} from 'sentry/views/starfish/components/spanDescription';

jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/usePageFilters');

describe('DatabaseSpanDescription', function () {
  const organization = Organization({
    features: ['performance-database-view-query-source'],
  });
  jest.mocked(useOrganization).mockReturnValue(organization);

  const project = Project();

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

  const groupId = '2ed2abf6ce7e3577';
  const spanId = 'abfed2aabf';
  const eventId = '65c7d8647b8a76ef8f4c05d41deb7860';

  it('shows preliminary description if no more data is available', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: [],
    });

    render(
      <DatabaseSpanDescription
        groupId={groupId}
        preliminaryDescription="SELECT USERS FRO*"
      />
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    expect(screen.getByText('SELECT USERS FRO*')).toBeInTheDocument();
  });

  it('shows full query if full event is available', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'transaction.id': eventId,
            project: project.slug,
            span_id: spanId,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/${project.slug}:${eventId}/`,
      body: {
        id: eventId,
        entries: [
          {
            type: EntryType.SPANS,
            data: [
              {
                span_id: spanId,
                description: 'SELECT users FROM my_table LIMIT 1;',
              },
            ],
          },
        ],
      },
    });

    render(
      <DatabaseSpanDescription
        groupId={groupId}
        preliminaryDescription="SELECT USERS FRO*"
      />
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    expect(screen.getByText('SELECT users FROM my_table LIMIT 1;')).toBeInTheDocument();
  });

  it('shows query source if available', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'transaction.id': eventId,
            project: project.slug,
            span_id: spanId,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/${project.slug}:${eventId}/`,
      body: {
        id: eventId,
        entries: [
          {
            type: EntryType.SPANS,
            data: [
              {
                span_id: spanId,
                description: 'SELECT users FROM my_table LIMIT 1;',
                data: {
                  'code.filepath': '/app/views/users.py',
                  'code.lineno': 78,
                },
              },
            ],
          },
        ],
      },
    });

    render(
      <DatabaseSpanDescription
        groupId={groupId}
        preliminaryDescription="SELECT USERS FRO*"
      />,
      {organization}
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    expect(screen.getByText('SELECT users FROM my_table LIMIT 1;')).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('/app/views/users.py at line 78'))
    ).toBeInTheDocument();
  });
});

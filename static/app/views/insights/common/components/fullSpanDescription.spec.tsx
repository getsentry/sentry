import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import usePageFilters from 'sentry/utils/usePageFilters';
import {FullSpanDescription} from 'sentry/views/insights/common/components/fullSpanDescription';
import {ModuleName} from 'sentry/views/insights/types';

jest.mock('sentry/utils/usePageFilters');

describe('FullSpanDescription', function () {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const organization = OrganizationFixture();

  const project = ProjectFixture();

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

  it('uses the correct code formatting for SQL queries', async function () {
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
      <FullSpanDescription
        group={groupId}
        shortDescription={'SELECT users FRO*'}
        moduleName={ModuleName.DB}
      />,
      {organization}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const queryCodeSnippet = await screen.findByText(
      /select users from my_table limit 1;/i
    );
    expect(queryCodeSnippet).toBeInTheDocument();
    expect(queryCodeSnippet).toHaveClass('language-sql');
  });

  it('uses the correct code formatting for MongoDB queries', async function () {
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
                description: `{"insert": "my_cool_collection😎", "a": {}}`,
                data: {'db.system': 'mongodb'},
              },
            ],
          },
        ],
      },
    });

    render(<FullSpanDescription group={groupId} moduleName={ModuleName.DB} />, {
      organization,
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const queryCodeSnippet = screen.getByText(
      /\{ "insert": "my_cool_collection😎", "a": \{\} \}/i
    );
    expect(queryCodeSnippet).toBeInTheDocument();
    expect(queryCodeSnippet).toHaveClass('language-json');
  });

  it('successfully handles truncated MongoDB queries', async function () {
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
                description: `{"insert": "my_cool_collection😎", "a": {}, "uh_oh":"the_query_is_truncated", "ohno*`,
                data: {'db.system': 'mongodb'},
              },
            ],
          },
        ],
      },
    });

    render(<FullSpanDescription group={groupId} moduleName={ModuleName.DB} />, {
      organization,
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // The last truncated entry will have a null value assigned and the JSON document is properly closed
    const queryCodeSnippet = screen.getByText(
      /\{ "insert": "my_cool_collection😎", "a": \{\}, "uh_oh": "the_query_is_truncated", "ohno\*": null \}/i
    );
    expect(queryCodeSnippet).toBeInTheDocument();
    expect(queryCodeSnippet).toHaveClass('language-json');
  });
});

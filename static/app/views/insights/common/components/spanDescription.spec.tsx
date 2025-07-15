import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import usePageFilters from 'sentry/utils/usePageFilters';
import {DatabaseSpanDescription} from 'sentry/views/insights/common/components/spanDescription';

jest.mock('sentry/utils/usePageFilters');

describe('DatabaseSpanDescription', function () {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const organization = OrganizationFixture();

  const project = ProjectFixture();

  jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

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
      />,
      {organization}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByText('SELECT USERS FRO*')).toBeInTheDocument();
  });

  it('shows full query from indexed span', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'transaction.id': eventId,
            project: project.slug,
            span_id: spanId,
            'span.description': 'SELECT users FROM my_table LIMIT 1;',
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

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(
      await screen.findByText('SELECT users FROM my_table LIMIT 1;')
    ).toBeInTheDocument();
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
            'code.filepath': '/app/views/users.py',
            'code.lineno': 78,
            'span.description': 'SELECT users FROM my_table LIMIT 1;',
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

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(
      await screen.findByText('SELECT users FROM my_table LIMIT 1;')
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('/app/views/users.py at line 78'))
    ).toBeInTheDocument();
  });

  it('correctly formats and displays MongoDB queries', async function () {
    const sampleMongoDBQuery = `{"a": "?", "insert": "documents"}`;

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'transaction.span_id': eventId,
            project: project.slug,
            span_id: spanId,
            'span.description': sampleMongoDBQuery,
            'db.system': 'mongodb',
          },
        ],
      },
    });

    render(
      <DatabaseSpanDescription
        groupId={groupId}
        preliminaryDescription={sampleMongoDBQuery}
      />,
      {organization}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // expect(await screen.findBy).toBeInTheDocument();
    const mongoQuerySnippet = await screen.findByText(
      /\{ "a": "\?", "insert": "documents" \}/i
    );
    expect(mongoQuerySnippet).toBeInTheDocument();
    expect(mongoQuerySnippet).toHaveClass('language-json');
  });
});

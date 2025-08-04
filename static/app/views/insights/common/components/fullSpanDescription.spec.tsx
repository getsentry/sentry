import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

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

  jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

  const groupId = '2ed2abf6ce7e3577';
  const spanId = 'abfed2aabf';

  it('uses the correct code formatting for SQL queries', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            project: project.slug,
            span_id: spanId,
            'span.description': 'SELECT users FROM my_table LIMIT 1;',
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
            project: project.slug,
            span_id: spanId,
            'span.description': `{"insert": "my_cool_collection😎", "a": {}}`,
            'db.system': 'mongodb',
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
            project: project.slug,
            span_id: spanId,
            'span.description': `{"insert": "my_cool_collection😎", "a": {}, "uh_oh":"the_query_is_truncated", "ohno*`,
            'db.system': 'mongodb',
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

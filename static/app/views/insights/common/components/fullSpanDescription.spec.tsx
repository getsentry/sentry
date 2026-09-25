import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {FullSpanDescription} from 'sentry/views/insights/common/components/fullSpanDescription';
import {ModuleName} from 'sentry/views/insights/types';

describe('FullSpanDescription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  const organization = OrganizationFixture();

  const project = ProjectFixture();

  const groupId = '2ed2abf6ce7e3577';
  const spanId = 'abfed2aabf';

  it('uses the correct code formatting for SQL queries', async () => {
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
        shortDescription="SELECT users FRO*"
        moduleName={ModuleName.DB}
      />,
      {organization}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const queryCodeSnippet = screen.getByText(
      (_, element) =>
        element?.tagName === 'CODE' && element.className.includes('language-sql')
    );
    expect(queryCodeSnippet).toBeInTheDocument();
    expect(queryCodeSnippet?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
      /select users from my_table limit 1;/i
    );
  });

  it('uses the correct code formatting for MongoDB queries', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            project: project.slug,
            span_id: spanId,
            'span.description': '{"insert": "my_cool_collection😎", "a": {}}',
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
      (_, element) =>
        element?.tagName === 'CODE' && element.className.includes('language-json')
    );
    expect(queryCodeSnippet).toBeInTheDocument();
    expect(queryCodeSnippet?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
      /\{ "insert": "my_cool_collection😎", "a": \{\} \}/i
    );
  });

  it('successfully handles truncated MongoDB queries', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            project: project.slug,
            span_id: spanId,
            'span.description':
              '{"insert": "my_cool_collection😎", "a": {}, "uh_oh":"the_query_is_truncated", "ohno*',
            'db.system.name': 'mongodb',
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
      (_, element) =>
        element?.tagName === 'CODE' && element.className.includes('language-json')
    );
    expect(queryCodeSnippet).toBeInTheDocument();
    expect(queryCodeSnippet?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
      /\{ "insert": "my_cool_collection😎", "a": \{\}, "uh_oh": "the_query_is_truncated", "ohno\*": null \}/i
    );
  });
});

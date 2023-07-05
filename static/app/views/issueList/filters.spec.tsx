import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueListFilters from 'sentry/views/issueList/filters';

describe('IssueListFilters', () => {
  const onSearch = jest.fn();
  const baseQuery = 'is:unresolved';

  beforeEach(() => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/searches/',
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('should search the correct category when the IssueCategoryFilter dropdown is used', async () => {
    render(<IssueListFilters query={baseQuery} onSearch={onSearch} />);

    const filterDropdown = screen.getByRole('button', {name: 'All Categories'});
    expect(filterDropdown).toBeInTheDocument();

    await userEvent.click(filterDropdown);

    const errorsOption = screen.getByTestId('error');
    expect(errorsOption).toBeInTheDocument();
    await userEvent.click(errorsOption);
    expect(onSearch).toHaveBeenCalledWith(`${baseQuery} issue.category:error`);

    await userEvent.click(filterDropdown);

    const performanceOption = screen.getByTestId('performance');
    expect(performanceOption).toBeInTheDocument();
    await userEvent.click(performanceOption);
    expect(onSearch).toHaveBeenCalledWith(`${baseQuery} issue.category:performance`);

    await userEvent.click(filterDropdown);

    const allCategoriesOption = screen.getByTestId('all_categories');
    expect(allCategoriesOption).toBeInTheDocument();
    await userEvent.click(allCategoriesOption);
    expect(onSearch).toHaveBeenCalledWith(baseQuery);
  });

  it('should update the search bar query string when an IssueCategoryFilter dropdown option is selected', () => {
    const {rerender} = render(<IssueListFilters query={baseQuery} onSearch={onSearch} />);

    const filterDropdown = screen.getByTestId('issue-category-filter');
    expect(filterDropdown).toHaveTextContent('All Categories');

    rerender(
      <IssueListFilters query={`${baseQuery} issue.category:error`} onSearch={onSearch} />
    );
    expect(filterDropdown).toHaveTextContent('Errors');

    rerender(
      <IssueListFilters
        query={`${baseQuery} issue.category:performance`}
        onSearch={onSearch}
      />
    );
    expect(filterDropdown).toHaveTextContent('Performance');

    rerender(<IssueListFilters query="" onSearch={onSearch} />);
    expect(filterDropdown).toHaveTextContent('All Categories');
  });

  it('should filter by cron monitors', async () => {
    render(<IssueListFilters query="" onSearch={onSearch} />, {
      organization: TestStubs.Organization({features: ['issue-platform']}),
    });

    await userEvent.click(screen.getByRole('button', {name: 'All Categories'}));
    await userEvent.click(screen.getByRole('option', {name: /Crons/}));

    expect(onSearch).toHaveBeenCalledWith('issue.category:cron');
  });
});

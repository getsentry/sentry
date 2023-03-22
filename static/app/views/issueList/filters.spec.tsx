import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueListFilters from 'sentry/views/issueList/filters';

describe('IssueListFilters', () => {
  const onSearch = jest.fn();
  const savedSearch = TestStubs.Search({
    id: '789',
    query: 'is:unresolved TypeError',
    sort: 'date',
    name: 'Unresolved TypeErrors',
    projectId: 1,
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/organizations/org-slug/searches/',
    body: [savedSearch],
  });

  const baseQuery = 'is:unresolved';

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
});

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AdminSearchCombobox} from 'admin/components/adminSearchCombobox';

type Result = {
  id: string;
  name: string;
};

describe('AdminSearchCombobox', () => {
  it('queries and selects a result', async () => {
    const result: Result = {id: '1', name: 'Alice'};
    const onSelectResult = jest.fn<void, [Result]>();
    render(
      <AdminSearchCombobox
        label="Users"
        placeholder="Query users"
        getResultKey={item => item.id}
        getResultSearchTerms={item => [item.name]}
        onSelectResult={onSelectResult}
        queryOptions={query => ({
          queryKey: ['admin-search-test', query],
          queryFn: () => Promise.resolve([result]),
          staleTime: Infinity,
        })}
        renderResult={item => item.name}
      />
    );
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', {name: 'Users'});

    await user.type(input, 'ali');
    expect(await screen.findByText('Alice')).toBeInTheDocument();

    await user.click(screen.getByText('Alice'));
    expect(onSelectResult).toHaveBeenCalledWith(result);
  });
});

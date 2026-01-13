import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SearchBarAction from 'sentry/components/events/interfaces/searchBarAction';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

const options: NonNullable<
  React.ComponentProps<typeof SearchBarAction>['filterOptions']
> = [
  {
    value: 'types',
    label: 'Types',
    options: [
      {
        value: BreadcrumbType.HTTP,
        label: 'HTTP request',
        leadingItems: <span>http</span>,
      },
      {
        value: BreadcrumbType.TRANSACTION,
        label: 'Transaction',
        leadingItems: <span>transaction</span>,
      },
      {
        value: BreadcrumbType.UI,
        label: 'User Action',
        leadingItems: <span>ui</span>,
      },
      {
        value: BreadcrumbType.NAVIGATION,
        label: 'Navigation',
        leadingItems: <span>navigation</span>,
      },
      {
        value: BreadcrumbType.DEBUG,
        label: 'Debug',
        leadingItems: <span>debug</span>,
      },
      {
        value: BreadcrumbType.ERROR,
        label: 'Error',
        leadingItems: <span>error</span>,
      },
    ],
  },
  {
    value: 'levels',
    label: 'Levels',
    options: [
      {
        value: BreadcrumbLevelType.INFO,
        label: 'info',
        leadingItems: <span>info</span>,
      },
      {
        value: BreadcrumbLevelType.ERROR,
        label: 'error',
        leadingItems: <span>error</span>,
      },
    ],
  },
];

describe('SearchBarAction', () => {
  let handleFilter!: jest.Mock;

  beforeEach(() => {
    handleFilter = jest.fn();
  });

  it('default render', async () => {
    render(
      <SearchBarAction
        filterOptions={options}
        onFilterChange={handleFilter}
        onChange={() => null}
        placeholder=""
        query=""
      />
    );

    const filterDropdownMenu = screen.getByText('Filter By');
    await userEvent.click(filterDropdownMenu);

    // Types
    expect(screen.getByText('Types')).toBeInTheDocument();
    expect(screen.getByText('HTTP request')).toBeInTheDocument();
    expect(screen.getByText('Transaction')).toBeInTheDocument();
    expect(screen.getByText('User Action')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Debug')).toBeInTheDocument();
    expect(screen.getAllByText('Error')[0]).toBeInTheDocument();

    // Levels
    expect(screen.getByText('Levels')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getAllByText('Error')[1]).toBeInTheDocument();
  });

  it('Without Options', async () => {
    render(
      <SearchBarAction
        filterOptions={[]}
        onFilterChange={handleFilter}
        onChange={() => null}
        placeholder=""
        query=""
      />
    );

    expect(await screen.findByTestId('input-trailing-items')).toBeInTheDocument();
    expect(screen.queryByText('Types')).not.toBeInTheDocument();
    expect(screen.queryByText('Levels')).not.toBeInTheDocument();
  });

  it('With Option Type only', async () => {
    const typeOptions = options[0]!;
    render(
      <SearchBarAction
        filterOptions={[typeOptions]}
        onFilterChange={handleFilter}
        onChange={() => null}
        placeholder=""
        query=""
      />
    );

    const filterDropdownMenu = screen.getByText('Filter By');
    await userEvent.click(filterDropdownMenu);

    // Header
    expect(screen.getByText('Types')).toBeInTheDocument();
    expect(screen.queryByText('Levels')).not.toBeInTheDocument();

    // List Items
    expect(screen.getByText('HTTP request')).toBeInTheDocument();
    expect(screen.getByText('Transaction')).toBeInTheDocument();
    expect(screen.getByText('User Action')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Debug')).toBeInTheDocument();
    expect(screen.getAllByText('Error')[0]).toBeInTheDocument();

    const httpRequestItem = screen.getByText('HTTP request');
    await userEvent.click(httpRequestItem);

    const httpRequestOption = ('options' in typeOptions ? typeOptions.options : []).find(
      opt => opt.label === 'HTTP request'
    );
    expect(handleFilter).toHaveBeenCalledWith([httpRequestOption]);
  });

  it('With Option Level only', async () => {
    const levelOptions = options[1]!;
    render(
      <SearchBarAction
        filterOptions={[levelOptions]}
        onFilterChange={handleFilter}
        onChange={() => null}
        placeholder=""
        query=""
      />
    );

    const filterDropdownMenu = screen.getByText('Filter By');
    await userEvent.click(filterDropdownMenu);

    // Header
    expect(screen.getByText('Levels')).toBeInTheDocument();
    expect(screen.queryByText('Types')).not.toBeInTheDocument();

    // List Items
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();

    // Check Item
    const infoItem = screen.getByText('info');
    await userEvent.click(infoItem);

    const infoOption = ('options' in levelOptions ? levelOptions.options : []).find(
      opt => opt.label === 'info'
    );
    expect(handleFilter).toHaveBeenCalledWith([infoOption]);
  });
});

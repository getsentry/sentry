import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Level from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/level';
import Type from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type';
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
        leadingItems: <Type color="green300" type={BreadcrumbType.HTTP} />,
      },
      {
        value: BreadcrumbType.TRANSACTION,
        label: 'Transaction',
        leadingItems: <Type color="pink300" type={BreadcrumbType.TRANSACTION} />,
      },
      {
        value: BreadcrumbType.UI,
        label: 'User Action',
        leadingItems: <Type color="purple300" type={BreadcrumbType.UI} />,
      },
      {
        value: BreadcrumbType.NAVIGATION,
        label: 'Navigation',
        leadingItems: <Type color="green300" type={BreadcrumbType.NAVIGATION} />,
      },
      {
        value: BreadcrumbType.DEBUG,
        label: 'Debug',
        leadingItems: <Type color="purple300" type={BreadcrumbType.DEBUG} />,
      },
      {
        value: BreadcrumbType.ERROR,
        label: 'Error',
        leadingItems: <Type color="red300" type={BreadcrumbType.ERROR} />,
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
        leadingItems: <Level level={BreadcrumbLevelType.INFO} />,
      },
      {
        value: BreadcrumbLevelType.ERROR,
        label: 'error',
        leadingItems: <Level level={BreadcrumbLevelType.ERROR} />,
      },
    ],
  },
];

describe('SearchBarAction', () => {
  let handleFilter;

  beforeEach(() => {
    handleFilter = jest.fn();
  });

  it('default render', () => {
    const {container} = render(
      <SearchBarAction
        filterOptions={options}
        onFilterChange={handleFilter}
        onChange={() => null}
        placeholder=""
        query=""
      />
    );

    const filterDropdownMenu = screen.getByText('Filter By');
    userEvent.click(filterDropdownMenu);

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

    expect(container).toSnapshot();
  });

  it('Without Options', () => {
    render(
      <SearchBarAction
        filterOptions={[]}
        onFilterChange={handleFilter}
        onChange={() => null}
        placeholder=""
        query=""
      />
    );

    expect(screen.queryByText('Types')).not.toBeInTheDocument();
    expect(screen.queryByText('Levels')).not.toBeInTheDocument();
  });

  it('With Option Type only', () => {
    const typeOptions = options[0];
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
    userEvent.click(filterDropdownMenu);

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
    userEvent.click(httpRequestItem);

    const httpRequestOption = (typeOptions.options ?? []).find(
      opt => opt.label === 'HTTP request'
    );
    expect(handleFilter).toHaveBeenCalledWith([httpRequestOption]);
  });

  it('With Option Level only', () => {
    const levelOptions = options[1];
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
    userEvent.click(filterDropdownMenu);

    // Header
    expect(screen.getByText('Levels')).toBeInTheDocument();
    expect(screen.queryByText('Types')).not.toBeInTheDocument();

    // List Items
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();

    // Check Item
    const infoItem = screen.getByText('info');
    userEvent.click(infoItem);

    const infoOption = (levelOptions.options ?? []).find(opt => opt.label === 'info');
    expect(handleFilter).toHaveBeenCalledWith([infoOption]);
  });
});

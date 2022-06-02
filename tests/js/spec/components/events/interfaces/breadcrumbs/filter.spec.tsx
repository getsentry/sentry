import {mountWithTheme} from 'sentry-test/enzyme';

import Level from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/level';
import Type from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type';
import SearchBarActionFilter from 'sentry/components/events/interfaces/searchBarAction/searchBarActionFilter';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

const options: React.ComponentProps<typeof SearchBarActionFilter>['options'] = {
  ['Types']: [
    {
      id: BreadcrumbType.HTTP,
      description: 'HTTP request',
      symbol: <Type color="green300" type={BreadcrumbType.HTTP} />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.TRANSACTION,
      description: 'Transaction',
      symbol: <Type color="pink300" type={BreadcrumbType.TRANSACTION} />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.UI,
      description: 'User Action',
      symbol: <Type color="purple300" type={BreadcrumbType.UI} />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.NAVIGATION,
      description: 'Navigation',
      symbol: <Type color="green300" type={BreadcrumbType.NAVIGATION} />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.DEBUG,
      description: 'Debug',
      symbol: <Type color="purple300" type={BreadcrumbType.DEBUG} />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.ERROR,
      description: 'Error',
      symbol: <Type color="red300" type={BreadcrumbType.ERROR} />,
      isChecked: true,
    },
  ],
  ['Levels']: [
    {
      id: BreadcrumbLevelType.INFO,
      symbol: <Level level={BreadcrumbLevelType.INFO} />,
      isChecked: true,
    },
    {
      id: BreadcrumbLevelType.ERROR,
      symbol: <Level level={BreadcrumbLevelType.ERROR} />,
      isChecked: true,
    },
  ],
};

describe('SearchBarActionFilter', () => {
  let handleFilter;

  beforeEach(() => {
    handleFilter = jest.fn();
  });

  it('default render', () => {
    const wrapper = mountWithTheme(
      <SearchBarActionFilter options={options} onChange={handleFilter} />
    );

    const filterDropdownMenu = wrapper.find('StyledContent');

    // Headers
    const headers = filterDropdownMenu.find('Header');
    expect(headers).toHaveLength(2);
    expect(headers.at(0).text()).toBe('Types');
    expect(headers.at(1).text()).toBe('Levels');

    // Lists
    const lists = filterDropdownMenu.find('StyledList');
    expect(lists).toHaveLength(2);
    expect(lists.at(0).find('StyledListItem')).toHaveLength(6);
    expect(lists.at(1).find('StyledListItem')).toHaveLength(2);

    expect(wrapper).toSnapshot();
  });

  it('Without Options', () => {
    const wrapper = mountWithTheme(
      <SearchBarActionFilter options={{}} onChange={handleFilter} />
    );
    expect(wrapper.find('Header').exists()).toBe(false);
    expect(wrapper.find('StyledListItem').exists()).toBe(false);
  });

  it('With Option Type only', () => {
    const {Types} = options;
    const wrapper = mountWithTheme(
      <SearchBarActionFilter options={{Types}} onChange={handleFilter} />
    );

    const filterDropdownMenu = wrapper.find('StyledContent');

    // Header
    const header = filterDropdownMenu.find('Header');
    expect(header).toHaveLength(1);
    expect(header.text()).toBe('Types');

    // List
    const list = filterDropdownMenu.find('StyledList');
    expect(list).toHaveLength(1);

    // List Items
    const listItems = list.find('StyledListItem');
    expect(listItems).toHaveLength(6);
    const firstItem = listItems.at(0);
    expect(firstItem.find('Description').text()).toBe(options.Types[0].description);

    // Check Item
    expect(firstItem.find('CheckboxFancy').props().isChecked).toBeTruthy();
    firstItem.simulate('click');

    expect(handleFilter).toHaveBeenCalledTimes(1);
  });

  it('With Option Level only', () => {
    const {Levels} = options;
    const wrapper = mountWithTheme(
      <SearchBarActionFilter options={{Levels}} onChange={handleFilter} />
    );

    const filterDropdownMenu = wrapper.find('StyledContent');

    // Header
    const header = filterDropdownMenu.find('Header');
    expect(header).toHaveLength(1);
    expect(header.text()).toBe('Levels');

    // List
    const list = filterDropdownMenu.find('StyledList');
    expect(list).toHaveLength(1);

    // List Items
    const listItems = list.find('StyledListItem');
    expect(listItems).toHaveLength(2);
    const firstItem = listItems.at(0);
    expect(firstItem.text()).toBe('Info');

    // Check Item
    expect(firstItem.find('CheckboxFancy').props().isChecked).toBeTruthy();

    firstItem.simulate('click');

    expect(handleFilter).toHaveBeenCalledTimes(1);
  });
});

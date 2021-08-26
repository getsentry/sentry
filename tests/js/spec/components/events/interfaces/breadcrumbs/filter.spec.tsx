import * as React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Icon from 'app/components/events/interfaces/breadcrumbs/icon';
import Level from 'app/components/events/interfaces/breadcrumbs/level';
import SearchBarActionFilter from 'app/components/events/interfaces/searchBarAction/searchBarActionFilter';
import {IconFire, IconFix, IconLocation, IconSpan, IconSwitch, IconUser} from 'app/icons';
import {BreadcrumbLevelType, BreadcrumbType} from 'app/types/breadcrumbs';

const options: React.ComponentProps<typeof SearchBarActionFilter>['options'] = {
  ['Types']: [
    {
      id: BreadcrumbType.HTTP,
      description: 'HTTP request',
      symbol: <Icon color="green300" icon={IconSwitch} size="xs" />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.TRANSACTION,
      description: 'Transaction',
      symbol: <Icon color="pink300" icon={IconSpan} size="xs" />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.UI,
      description: 'User Action',
      symbol: <Icon color="purple300" icon={IconUser} size="xs" />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.NAVIGATION,
      description: 'Navigation',
      symbol: <Icon color="green300" icon={IconLocation} size="xs" />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.DEBUG,
      description: 'Debug',
      symbol: <Icon color="purple300" icon={IconFix} size="xs" />,
      isChecked: true,
    },
    {
      id: BreadcrumbType.ERROR,
      description: 'Error',
      symbol: <Icon color="red300" icon={IconFire} size="xs" />,
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
    const lists = filterDropdownMenu.find('List');
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
    const list = filterDropdownMenu.find('List');
    expect(list).toHaveLength(1);

    // List Items
    const listItems = list.find('StyledListItem');
    expect(listItems).toHaveLength(6);
    const firstItem = listItems.at(0);
    expect(firstItem.find('Description').text()).toBe(options.Types[0].description);

    // Check Item
    expect(
      firstItem.find('[role="checkbox"]').find('CheckboxFancyContent').props().isChecked
    ).toBeTruthy();
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
    const list = filterDropdownMenu.find('List');
    expect(list).toHaveLength(1);

    // List Items
    const listItems = list.find('StyledListItem');
    expect(listItems).toHaveLength(2);
    const firstItem = listItems.at(0);
    expect(firstItem.text()).toBe(options.Levels[0].id);

    // Check Item
    expect(
      firstItem.find('[role="checkbox"]').find('CheckboxFancyContent').props().isChecked
    ).toBeTruthy();

    firstItem.simulate('click');

    expect(handleFilter).toHaveBeenCalledTimes(1);
  });
});

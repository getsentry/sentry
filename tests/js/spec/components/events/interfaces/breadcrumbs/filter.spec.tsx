import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {IconUser, IconLocation, IconSpan, IconSwitch, IconFix, IconFire} from 'app/icons';
import Filter from 'app/components/events/interfaces/breadcrumbs/filter';
import Level from 'app/components/events/interfaces/breadcrumbs/level';
import Icon from 'app/components/events/interfaces/breadcrumbs/icon';
import {
  BreadcrumbType,
  BreadcrumbLevelType,
} from 'app/components/events/interfaces/breadcrumbs/types';

const options: React.ComponentProps<typeof Filter>['options'] = [
  [
    {
      type: BreadcrumbType.HTTP,
      description: 'HTTP request',
      levels: [BreadcrumbLevelType.INFO],
      symbol: <Icon color="green400" icon={IconSwitch} size="xs" />,
      isChecked: true,
    },
    {
      type: BreadcrumbType.TRANSACTION,
      description: 'Transaction',
      levels: [BreadcrumbLevelType.ERROR],
      symbol: <Icon color="pink300" icon={IconSpan} size="xs" />,
      isChecked: true,
    },
    {
      type: BreadcrumbType.UI,
      description: 'User Action',
      levels: [BreadcrumbLevelType.INFO],
      symbol: <Icon color="purple400" icon={IconUser} size="xs" />,
      isChecked: true,
    },
    {
      type: BreadcrumbType.NAVIGATION,
      description: 'Navigation',
      levels: [BreadcrumbLevelType.INFO],
      symbol: <Icon color="green500" icon={IconLocation} size="xs" />,
      isChecked: true,
    },
    {
      type: BreadcrumbType.DEBUG,
      description: 'Debug',
      levels: [BreadcrumbLevelType.INFO],
      symbol: <Icon color="purple500" icon={IconFix} size="xs" />,
      isChecked: true,
    },
    {
      type: BreadcrumbType.ERROR,
      description: 'Error',
      levels: [BreadcrumbLevelType.ERROR],
      symbol: <Icon color="red400" icon={IconFire} size="xs" />,
      isChecked: true,
    },
  ],
  [
    {
      type: BreadcrumbLevelType.INFO,
      symbol: <Level level={BreadcrumbLevelType.INFO} />,
      isChecked: true,
    },
    {
      type: BreadcrumbLevelType.ERROR,
      symbol: <Level level={BreadcrumbLevelType.ERROR} />,
      isChecked: true,
    },
  ],
];

describe('Filter', () => {
  let handleFilter;

  beforeEach(() => {
    handleFilter = jest.fn();
  });

  it('default render', () => {
    const wrapper = mountWithTheme(<Filter options={options} onFilter={handleFilter} />);

    expect(wrapper.find('OptionsGroup')).toHaveLength(2);
    expect(wrapper.find('OptionsGroup').at(0).find('Header').text()).toBe('Type');
    expect(wrapper.find('OptionsGroup').at(0).find('ListItem')).toHaveLength(6);
    expect(wrapper.find('OptionsGroup').at(1).find('Header').text()).toBe('Level');
    expect(wrapper.find('OptionsGroup').at(1).find('ListItem')).toHaveLength(2);
    expect(wrapper).toSnapshot();
  });

  it('Without Options', () => {
    const wrapper = mountWithTheme(<Filter options={[[], []]} onFilter={handleFilter} />);
    expect(wrapper.find('Header')).toHaveLength(0);
    expect(wrapper.find('OptionsGroup')).toHaveLength(0);
  });

  it('With Option Type only', () => {
    const wrapper = mountWithTheme(
      <Filter options={[options[0], []]} onFilter={handleFilter} />
    );

    const optionsGroup = wrapper.find('OptionsGroup');

    expect(optionsGroup).toHaveLength(1);
    expect(optionsGroup.find('Header').text()).toBe('Type');
    expect(optionsGroup.find('ListItem')).toHaveLength(6);

    const firstOptionLevel = wrapper.find('OptionsGroup').at(0).find('ListItem').at(0);

    expect(firstOptionLevel.text()).toBe(options[0][0].description);
    expect(
      firstOptionLevel.find('[role="checkbox"]').find('CheckboxFancyContent').props()
        .isChecked
    ).toBeTruthy();

    firstOptionLevel.simulate('click');

    expect(handleFilter).toHaveBeenCalledTimes(1);
  });

  it('With Option Level only', () => {
    const wrapper = mountWithTheme(
      <Filter options={[[], options[1]]} onFilter={handleFilter} />
    );

    const optionsGroup = wrapper.find('OptionsGroup');

    expect(optionsGroup).toHaveLength(1);
    expect(optionsGroup.find('Header').text()).toBe('Level');
    expect(optionsGroup.find('ListItem')).toHaveLength(2);

    const firstOptionLevel = wrapper.find('OptionsGroup').at(0).find('ListItem').at(0);

    expect(firstOptionLevel.text()).toBe(options[1][0].type.toLocaleLowerCase());
    expect(
      firstOptionLevel.find('[role="checkbox"]').find('CheckboxFancyContent').props()
        .isChecked
    ).toBeTruthy();

    firstOptionLevel.simulate('click');

    expect(handleFilter).toHaveBeenCalledTimes(1);
  });
});

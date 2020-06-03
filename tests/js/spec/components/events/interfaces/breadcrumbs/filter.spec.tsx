import React from 'react';

import {shallow, mountWithTheme} from 'sentry-test/enzyme';

import {IconUser, IconLocation, IconSpan, IconSwitch, IconFix, IconFire} from 'app/icons';
import Filter from 'app/components/events/interfaces/breadcrumbsV2/filter/filter';
import Level from 'app/components/events/interfaces/breadcrumbsV2/level';
import Icon from 'app/components/events/interfaces/breadcrumbsV2/icon';
import {
  BreadcrumbType,
  BreadcrumbLevelType,
} from 'app/components/events/interfaces/breadcrumbsV2/types';

const options: React.ComponentProps<typeof Filter>['options'] = [
  [
    {
      type: BreadcrumbType.HTTP,
      description: 'HTTP request',
      levels: [BreadcrumbLevelType.INFO],
      symbol: <Icon color="green400" icon={IconSwitch} size="xs" />,
      isChecked: true,
      isDisabled: false,
    },
    {
      type: BreadcrumbType.TRANSACTION,
      description: 'Transaction',
      levels: [BreadcrumbLevelType.ERROR],
      symbol: <Icon color="pink400" icon={IconSpan} size="xs" />,
      isChecked: true,
      isDisabled: false,
    },
    {
      type: BreadcrumbType.UI,
      description: 'User Action',
      levels: [BreadcrumbLevelType.INFO],
      symbol: <Icon color="purple400" icon={IconUser} size="xs" />,
      isChecked: true,
      isDisabled: false,
    },
    {
      type: BreadcrumbType.NAVIGATION,
      description: 'Navigation',
      levels: [BreadcrumbLevelType.INFO],
      symbol: <Icon color="green500" icon={IconLocation} size="xs" />,
      isChecked: true,
      isDisabled: false,
    },
    {
      type: BreadcrumbType.DEBUG,
      description: 'Debug',
      levels: [BreadcrumbLevelType.INFO],
      symbol: <Icon color="purple500" icon={IconFix} size="xs" />,
      isChecked: true,
      isDisabled: false,
    },
    {
      type: BreadcrumbType.ERROR,
      description: 'Error',
      levels: [BreadcrumbLevelType.ERROR],
      symbol: <Icon color="red400" icon={IconFire} size="xs" />,
      isChecked: true,
      isDisabled: false,
    },
  ],
  [
    {
      type: BreadcrumbLevelType.INFO,
      symbol: <Level level={BreadcrumbLevelType.INFO} />,
      isChecked: true,
      isDisabled: false,
    },
    {
      type: BreadcrumbLevelType.ERROR,
      symbol: <Level level={BreadcrumbLevelType.ERROR} />,
      isChecked: true,
      isDisabled: false,
    },
  ],
];

describe('Filter', () => {
  it('default render', () => {
    const handleFilter = jest.fn();
    const handleCheckAll = jest.fn();
    const wrapper = mountWithTheme(
      <Filter options={options} onFilter={handleFilter} onCheckAll={handleCheckAll} />
    );

    debugger;
  });
});

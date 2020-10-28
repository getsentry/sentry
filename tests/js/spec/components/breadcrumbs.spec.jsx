import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import Breadcrumbs from 'app/components/breadcrumbs';

describe('Breadcrumbs', () => {
  const wrapper = shallow(
    <Breadcrumbs
      crumbs={[
        {
          label: 'Test 1',
          to: '/test1',
        },
        {
          label: 'Test 2',
          to: '/test2',
        },
        {
          label: 'Test 3',
          to: null,
        },
      ]}
    />
  );

  it('returns null when 0 crumbs', () => {
    const empty = shallow(<Breadcrumbs crumbs={[]} />);

    expect(empty.html()).toBeNull();
  });

  it('generates correct links', () => {
    const allElements = wrapper.find('BreadcrumbList').children();
    const links = wrapper.find('BreadcrumbLink');

    expect(links.length).toBe(2);
    expect(allElements.at(0).props().to).toBe('/test1');
    expect(allElements.at(0).props().children).toBe('Test 1');
    expect(allElements.at(2).props().to).toBe('/test2');
    expect(allElements.at(2).props().children).toBe('Test 2');
  });

  it('does not make links where no `to` is provided', () => {
    const allElements = wrapper.find('BreadcrumbList').children();
    const notLink = wrapper.find('BreadcrumbItem');

    expect(notLink.length).toBe(1);

    expect(allElements.at(4).props().to).toBeUndefined();
    expect(allElements.at(4).props().children).toBe('Test 3');
  });

  it('separates crumbs with icon', () => {
    const allElements = wrapper.find('BreadcrumbList').children();
    const dividers = wrapper.find('BreadcrumbDividerIcon');

    expect(dividers.length).toBe(2);

    expect(allElements.at(1).is('BreadcrumbDividerIcon')).toBeTruthy();
    expect(allElements.at(3).is('BreadcrumbDividerIcon')).toBeTruthy();
    expect(allElements.at(5).exists()).toBeFalsy();
  });
});

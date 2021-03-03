import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';

const items = [1, 2, 3, 4, 5, 6, 7].map(i => <div key={i}>Item {i}</div>);

describe('Collapsible', function () {
  it('collapses items', function () {
    const wrapper = mountWithTheme(<Collapsible>{items}</Collapsible>);

    expect(wrapper.find('div').length).toBe(5);
    expect(wrapper.find('div').at(2).text()).toBe('Item 3');

    expect(wrapper.find('button[aria-label="Show 2 collapsed items"]').text()).toBe(
      'Show 2 collapsed items'
    );
    expect(wrapper.find('button[aria-label="Collapse"]').exists()).toBeFalsy();
  });

  it('expands items', function () {
    const wrapper = mountWithTheme(<Collapsible>{items}</Collapsible>);

    // expand
    wrapper.find('button[aria-label="Show 2 collapsed items"]').simulate('click');

    expect(wrapper.find('div').length).toBe(7);

    // collapse back
    wrapper.find('button[aria-label="Collapse"]').simulate('click');

    expect(wrapper.find('div').length).toBe(5);
  });

  it('respects maxVisibleItems prop', function () {
    const wrapper = mountWithTheme(
      <Collapsible maxVisibleItems={2}>{items}</Collapsible>
    );

    expect(wrapper.find('div').length).toBe(2);
  });

  it('does not collapse items below threshold', function () {
    const wrapper = mountWithTheme(
      <Collapsible maxVisibleItems={100}>{items}</Collapsible>
    );

    expect(wrapper.find('div').length).toBe(7);

    expect(wrapper.find('button').exists()).toBeFalsy();
  });

  it('takes custom buttons', function () {
    const wrapper = mountWithTheme(
      <Collapsible
        collapseButton={({onCollapse}) => (
          <Button onClick={onCollapse}>Custom Collapse</Button>
        )}
        expandButton={({onExpand, numberOfCollapsedItems}) => (
          <Button onClick={onExpand} aria-label="Expand">
            Custom Expand {numberOfCollapsedItems}
          </Button>
        )}
      >
        {items}
      </Collapsible>
    );

    expect(wrapper.find('button').length).toBe(1);

    // custom expand
    wrapper.find('button[aria-label="Expand"]').simulate('click');

    expect(wrapper.find('div').length).toBe(7);

    // custom collapse back
    wrapper.find('button[aria-label="Custom Collapse"]').simulate('click');

    expect(wrapper.find('div').length).toBe(5);
  });
});

import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import TableNotice from 'app/components/tableNotice';

const props = {
  allRowsCount: 64,
  selectedRowsCount: 10,
  onCancelAllRows: () => {},
  onSelectAllRows: () => {},
  columnsCount: 4,
  isPageSelected: false,
  isEverythingSelected: false,
};

describe('TableNotice', function() {
  it('does not render if the whole page is not selected', function() {
    const wrapper = shallow(<TableNotice {...props} />);
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('shows the right page summary', function() {
    const wrapper = shallow(<TableNotice {...props} isPageSelected />);
    expect(wrapper.text()).toBe(
      `${props.selectedRowsCount} items on this page selected. Select all ${props.allRowsCount} items.`
    );
  });

  it('can select all rows across all pages', function() {
    const onSelectAllRows = jest.fn();
    const wrapper = shallow(
      <TableNotice {...props} isPageSelected onSelectAllRows={onSelectAllRows} />
    );
    wrapper.find('a').simulate('click');
    expect(onSelectAllRows).toHaveBeenCalled();
  });

  it('can deselect all once everything is selected', function() {
    const onCancelAllRows = jest.fn();
    const wrapper = shallow(
      <TableNotice
        {...props}
        isPageSelected
        isEverythingSelected
        onCancelAllRows={onCancelAllRows}
      />
    );
    expect(wrapper.text()).toBe(
      `Selected all ${props.allRowsCount} items. Cancel selection.`
    );
    wrapper.find('a').simulate('click');
    expect(onCancelAllRows).toHaveBeenCalled();
  });
});

import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import BulkNotice, {
  getEverythingSelectedText,
  getSelectEverythingText,
} from 'app/components/bulkController/bulkNotice';

const props = {
  allRowsCount: 64,
  selectedRowsCount: 10,
  onCancelAllRows: () => {},
  onSelectAllRows: () => {},
  columnsCount: 4,
  isPageSelected: false,
  isEverythingSelected: false,
};

describe('BulkNotice', function() {
  it('does not render if the whole page is not selected', function() {
    const wrapper = shallow(<BulkNotice {...props} />);
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('shows the right page summary', function() {
    const wrapper = shallow(<BulkNotice {...props} isPageSelected />);
    expect(wrapper.text()).toBe(
      `${props.selectedRowsCount} items on this page selected. Select all ${props.allRowsCount} items.`
    );
  });

  it('can select all rows across all pages', function() {
    const onSelectAllRows = jest.fn();
    const wrapper = shallow(
      <BulkNotice {...props} isPageSelected onSelectAllRows={onSelectAllRows} />
    );
    wrapper.find('a').simulate('click');
    expect(onSelectAllRows).toHaveBeenCalled();
  });

  it('can deselect all once everything is selected', function() {
    const onCancelAllRows = jest.fn();
    const wrapper = shallow(
      <BulkNotice
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

describe('getEverythingSelectedText', () => {
  it('no allRowsCount, no bulkLimit', () => {
    expect(getEverythingSelectedText(undefined, undefined)).toBe(
      'Selected all items across all pages.'
    );
    expect(shallow(<div>{getEverythingSelectedText(123, undefined)}</div>).text()).toBe(
      'Selected all 123 items.'
    );
    expect(shallow(<div>{getEverythingSelectedText(123, 1000)}</div>).text()).toBe(
      'Selected all 123 items.'
    );
    expect(shallow(<div>{getEverythingSelectedText(1001, 1000)}</div>).text()).toBe(
      'Selected up to the first 1000 items.'
    );
  });
});

describe('getSelectEverythingText', () => {
  it('no allRowsCount, no bulkLimit', () => {
    expect(getSelectEverythingText(undefined, undefined)).toBe(
      'Select all items across all pages.'
    );
    expect(shallow(<div>{getSelectEverythingText(123, undefined)}</div>).text()).toBe(
      'Select all 123 items.'
    );
    expect(shallow(<div>{getSelectEverythingText(123, 1000)}</div>).text()).toBe(
      'Select all 123 items.'
    );
    expect(shallow(<div>{getSelectEverythingText(1001, 1000)}</div>).text()).toBe(
      'Select the first 1000 items.'
    );
  });
});

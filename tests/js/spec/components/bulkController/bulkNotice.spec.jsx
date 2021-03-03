import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import BulkNotice from 'app/components/bulkController/bulkNotice';

const props = {
  allRowsCount: 64,
  selectedRowsCount: 10,
  bulkLimit: undefined,
  onUnselectAllRows: () => {},
  onSelectAllRows: () => {},
  columnsCount: 4,
  isPageSelected: false,
  isAllSelected: false,
};

describe('BulkNotice', function () {
  it('does not render if the whole page is not selected', function () {
    const wrapper = shallow(<BulkNotice {...props} />);
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('shows the right page summary', function () {
    const wrapper = shallow(<BulkNotice {...props} isPageSelected />);
    expect(wrapper.text()).toBe(
      `${props.selectedRowsCount} items on this page selected. Select all ${props.allRowsCount} items.`
    );

    expect(
      shallow(<BulkNotice {...props} isPageSelected allRowsCount={undefined} />).text()
    ).toContain('Select all items across all pages');

    expect(
      shallow(
        <BulkNotice {...props} isPageSelected allRowsCount={1001} bulkLimit={1000} />
      ).text()
    ).toContain('Select the first 1000 items.');
  });

  it('can select all rows across all pages', function () {
    const onSelectAllRows = jest.fn();
    const wrapper = shallow(
      <BulkNotice {...props} isPageSelected onSelectAllRows={onSelectAllRows} />
    );
    wrapper.find('AlertButton').simulate('click');
    expect(onSelectAllRows).toHaveBeenCalled();
  });

  it('can deselect all once everything is selected', function () {
    const onUnselectAllRows = jest.fn();
    const wrapper = shallow(
      <BulkNotice
        {...props}
        isPageSelected
        isAllSelected
        onUnselectAllRows={onUnselectAllRows}
      />
    );
    expect(wrapper.text()).toBe(
      `Selected all ${props.allRowsCount} items. Cancel selection.`
    );
    wrapper.find('AlertButton').simulate('click');
    expect(onUnselectAllRows).toHaveBeenCalled();
  });

  it('show the right selected all across all pages summary', function () {
    expect(
      shallow(
        <BulkNotice
          {...props}
          isPageSelected
          isAllSelected
          allRowsCount={undefined}
          bulkLimit={undefined}
        />
      ).text()
    ).toContain('Selected all items across all pages.');

    expect(
      shallow(
        <BulkNotice
          {...props}
          isPageSelected
          isAllSelected
          allRowsCount={123}
          bulkLimit={undefined}
        />
      ).text()
    ).toContain('Selected all 123 items.');

    expect(
      shallow(
        <BulkNotice
          {...props}
          isPageSelected
          isAllSelected
          allRowsCount={1001}
          bulkLimit={1000}
        />
      ).text()
    ).toContain('Selected up to the first 1000 items.');
  });
});

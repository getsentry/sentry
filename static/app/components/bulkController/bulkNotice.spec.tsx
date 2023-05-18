import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BulkNotice from 'sentry/components/bulkController/bulkNotice';

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
    const wrapper = render(<BulkNotice {...props} />);
    expect(wrapper.container).toBeEmptyDOMElement();
  });

  it('shows the right page summary', function () {
    const wrapper = render(<BulkNotice {...props} isPageSelected />);
    expect(wrapper.container).toHaveTextContent(
      `${props.selectedRowsCount} items on this page selected. Select all ${props.allRowsCount} items.`
    );

    wrapper.rerender(<BulkNotice {...props} isPageSelected allRowsCount={undefined} />);
    expect(wrapper.container).toHaveTextContent('Select all items across all pages');

    wrapper.rerender(
      <BulkNotice {...props} isPageSelected allRowsCount={1001} bulkLimit={1000} />
    );
    expect(wrapper.container).toHaveTextContent('Select the first 1000 items.');
  });

  it('can select all rows across all pages', async function () {
    const onSelectAllRows = jest.fn();
    render(<BulkNotice {...props} isPageSelected onSelectAllRows={onSelectAllRows} />);

    await userEvent.click(screen.getByRole('button', {name: 'Select all 64 items.'}));
    expect(onSelectAllRows).toHaveBeenCalled();
  });

  it('can deselect all once everything is selected', async function () {
    const onUnselectAllRows = jest.fn();
    const wrapper = render(
      <BulkNotice
        {...props}
        isPageSelected
        isAllSelected
        onUnselectAllRows={onUnselectAllRows}
      />
    );
    expect(wrapper.container).toHaveTextContent(
      `Selected all ${props.allRowsCount} items. Cancel selection.`
    );
    await userEvent.click(screen.getByRole('button', {name: 'Cancel selection.'}));
    expect(onUnselectAllRows).toHaveBeenCalled();
  });

  it('show the right selected all across all pages summary', function () {
    const wrapper = render(
      <BulkNotice
        {...props}
        isPageSelected
        isAllSelected
        allRowsCount={undefined}
        bulkLimit={undefined}
      />
    );
    expect(wrapper.container).toHaveTextContent('Selected all items across all pages.');

    wrapper.rerender(
      <BulkNotice
        {...props}
        isPageSelected
        isAllSelected
        allRowsCount={123}
        bulkLimit={undefined}
      />
    );
    expect(wrapper.container).toHaveTextContent('Selected all 123 items.');

    wrapper.rerender(
      <BulkNotice
        {...props}
        isPageSelected
        isAllSelected
        allRowsCount={1001}
        bulkLimit={1000}
      />
    );
    expect(wrapper.container).toHaveTextContent('Selected up to the first 1000 items.');
  });
});

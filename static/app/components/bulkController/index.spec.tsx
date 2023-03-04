import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BulkController from 'sentry/components/bulkController';

describe('BulkController', function () {
  const pageIds = ['1', '2', '3'];
  const renderProp = jest.fn();

  let toggleRow: any,
    selectPage: any,
    deselectPage: any,
    selectAll: any,
    unselectAll: any;

  const renderComponent = (pIds = pageIds, defaultSelectedIds?: string[]) => {
    const wrapper = render(
      <BulkController
        allRowsCount={32}
        pageIds={pIds}
        defaultSelectedIds={defaultSelectedIds}
        columnsCount={4}
      >
        {({
          isAllSelected,
          isPageSelected,
          selectedIds,
          onRowToggle,
          onAllRowsToggle,
          onPageRowsToggle,
        }) => {
          renderProp(isAllSelected, isPageSelected, selectedIds);
          return (
            <Fragment>
              {isPageSelected && 'whole page selected'}
              {isAllSelected && 'everything selected'}
              <button data-test-id="selectAll" onClick={() => onAllRowsToggle(true)} />
              <button data-test-id="selectPage" onClick={() => onPageRowsToggle(true)} />
              <button data-test-id="unselectAll" onClick={() => onAllRowsToggle(false)} />
              <button
                data-test-id="deselectPage"
                onClick={() => onPageRowsToggle(false)}
              />
              <button data-test-id="toggleRow" onClick={() => onRowToggle('2')} />
            </Fragment>
          );
        }}
      </BulkController>
    );
    toggleRow = screen.getByTestId('toggleRow');
    selectPage = screen.getByTestId('selectPage');
    deselectPage = screen.getByTestId('deselectPage');
    selectAll = screen.getByTestId('selectAll');
    unselectAll = screen.getByTestId('unselectAll');
    return wrapper;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets the defaults', async function () {
    renderComponent();
    expect(renderProp).toHaveBeenLastCalledWith(false, false, []);
  });

  it('toggles single item', async function () {
    renderComponent();
    await userEvent.click(toggleRow);
    expect(renderProp).toHaveBeenLastCalledWith(false, false, ['2']);
    await userEvent.click(toggleRow);
    expect(renderProp).toHaveBeenLastCalledWith(false, false, []);
  });

  it('toggles the page', async function () {
    renderComponent();
    await userEvent.click(toggleRow);
    expect(renderProp).toHaveBeenLastCalledWith(false, false, ['2']);
    await userEvent.click(selectPage);
    expect(renderProp).toHaveBeenLastCalledWith(false, true, ['2', '1', '3']);
    await userEvent.click(deselectPage);
    expect(renderProp).toHaveBeenLastCalledWith(false, false, []);
  });

  it('toggles everything', async function () {
    renderComponent();
    await userEvent.click(toggleRow);
    expect(renderProp).toHaveBeenLastCalledWith(false, false, ['2']);
    await userEvent.click(selectAll);
    expect(renderProp).toHaveBeenLastCalledWith(true, true, ['1', '2', '3']);
    await userEvent.click(unselectAll);
    expect(renderProp).toHaveBeenLastCalledWith(false, false, []);
  });

  it('deselects one after having everything selected', async function () {
    renderComponent();
    await userEvent.click(selectAll);
    expect(renderProp).toHaveBeenLastCalledWith(true, true, ['1', '2', '3']);
    await userEvent.click(toggleRow);
    expect(renderProp).toHaveBeenLastCalledWith(false, false, ['1', '3']);
  });

  describe('with default selectIds', function () {
    it('sets the defaults', async function () {
      renderComponent(pageIds, ['2']);
      expect(renderProp).toHaveBeenLastCalledWith(false, false, ['2']);
    });

    it('page is selected by default', async function () {
      renderComponent(pageIds, pageIds);
      expect(renderProp).toHaveBeenLastCalledWith(false, true, pageIds);
    });

    it('toggle the last unchecked option, async should change button selectAll to true', async function () {
      const defaultSelectedIds = ['1', '3'];
      renderComponent(pageIds, defaultSelectedIds);
      expect(renderProp).toHaveBeenLastCalledWith(false, false, defaultSelectedIds);
      await userEvent.click(toggleRow);
      expect(renderProp).toHaveBeenLastCalledWith(false, true, [
        ...defaultSelectedIds,
        '2',
      ]);
    });
  });
});

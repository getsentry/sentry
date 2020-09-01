import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import BulkController from 'app/components/bulkController';

describe('BulkController', function() {
  let wrapper,
    renderProp,
    toggleRow,
    selectPage,
    deselectPage,
    selectEverything,
    deselectEverything;

  beforeEach(function() {
    renderProp = jest.fn();
    wrapper = shallow(
      <BulkController allIdsCount={32} pageIds={[1, 2, 3]} noticeColumns={4}>
        {({
          isEverythingSelected,
          isPageSelected,
          selectedIds,
          onIdToggle,
          onAllIdsToggle,
          onPageIdsToggle,
        }) => {
          renderProp(isEverythingSelected, isPageSelected, selectedIds);
          return (
            <React.Fragment>
              {isPageSelected && 'whole page selected'}
              {isEverythingSelected && 'everything selected'}
              <button data-test-id="selectAll" onClick={() => onAllIdsToggle(true)} />
              <button data-test-id="selectPage" onClick={() => onPageIdsToggle(true)} />
              <button data-test-id="deselectAll" onClick={() => onAllIdsToggle(false)} />
              <button
                data-test-id="deselectPage"
                onClick={() => onPageIdsToggle(false)}
              />
              <button data-test-id="toggleRow" onClick={() => onIdToggle(2)} />
            </React.Fragment>
          );
        }}
      </BulkController>
    );
    toggleRow = wrapper.find('[data-test-id="toggleRow"]');
    selectPage = wrapper.find('[data-test-id="selectPage"]');
    deselectPage = wrapper.find('[data-test-id="deselectPage"]');
    selectEverything = wrapper.find('[data-test-id="selectAll"]');
    deselectEverything = wrapper.find('[data-test-id="deselectAll"]');
  });

  it('sets the defaults', function() {
    expect(renderProp).toHaveBeenLastCalledWith(false, false, []);
  });

  it('toggles single item', function() {
    toggleRow.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(false, false, [2]);
    toggleRow.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(false, false, []);
  });

  it('toggles the page', function() {
    toggleRow.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(false, false, [2]);
    selectPage.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(false, true, [2, 1, 3]);
    deselectPage.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(false, false, []);
  });

  it('toggles everything', function() {
    toggleRow.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(false, false, [2]);
    selectEverything.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(true, true, [1, 2, 3]);
    deselectEverything.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(false, false, []);
  });

  it('deselects one after having everything selected', function() {
    selectEverything.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(true, true, [1, 2, 3]);
    toggleRow.simulate('click');
    expect(renderProp).toHaveBeenLastCalledWith(false, false, [1, 3]);
  });
});

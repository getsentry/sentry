import {Fragment} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CompactSelect} from 'sentry/components/compactSelect';

describe('CompactSelect', function () {
  it('renders', function () {
    render(
      <CompactSelect
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
  });

  it('renders disabled', function () {
    render(
      <CompactSelect
        disabled
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders with menu title', async function () {
    render(
      <CompactSelect
        menuTitle="Menu title"
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );

    // click on the trigger button
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Menu title')).toBeInTheDocument();
  });

  it('can be dismissed', async function () {
    render(
      <Fragment>
        <CompactSelect
          value="opt_one"
          menuTitle="Menu A"
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
        <CompactSelect
          value="opt_three"
          menuTitle="Menu B"
          options={[
            {value: 'opt_three', label: 'Option Three'},
            {value: 'opt_four', label: 'Option Four'},
          ]}
        />
      </Fragment>
    );

    // Can be dismissed by clicking outside
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();

    // Can be dismissed by pressing Escape
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();

    // When menu A is open, clicking once on menu B's trigger button closes menu A and
    // then opens menu B
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Option Three'}));
    expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Option Three'})).toBeInTheDocument();
  });

  describe('ListBox', function () {
    it('updates trigger label on selection', async function () {
      const mock = jest.fn();
      render(
        <CompactSelect
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          onChange={mock}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One
      await userEvent.click(screen.getByRole('option', {name: 'Option One'}));

      expect(mock).toHaveBeenCalledWith({value: 'opt_one', label: 'Option One'});
      expect(screen.getByRole('button', {name: 'Option One'})).toBeInTheDocument();
    });

    it('can select multiple options', async function () {
      const mock = jest.fn();
      render(
        <CompactSelect
          multiple
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          onChange={mock}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One & Option Two
      await userEvent.click(screen.getByRole('option', {name: 'Option One'}));
      await userEvent.click(screen.getByRole('option', {name: 'Option Two'}));

      expect(mock).toHaveBeenCalledWith([
        {value: 'opt_one', label: 'Option One'},
        {value: 'opt_two', label: 'Option Two'},
      ]);
      expect(screen.getByRole('button', {name: 'Option One +1'})).toBeInTheDocument();
    });

    it('can select options with values containing quotes', async function () {
      const mock = jest.fn();
      render(
        <CompactSelect
          multiple
          options={[
            {value: '"opt_one"', label: 'Option One'},
            {value: '"opt_two"', label: 'Option Two'},
          ]}
          onChange={mock}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One & Option Two
      await userEvent.click(screen.getByRole('option', {name: 'Option One'}));
      await userEvent.click(screen.getByRole('option', {name: 'Option Two'}));

      expect(mock).toHaveBeenCalledWith([
        {value: '"opt_one"', label: 'Option One'},
        {value: '"opt_two"', label: 'Option Two'},
      ]);
    });

    it('displays trigger button with prefix', function () {
      render(
        <CompactSelect
          triggerProps={{prefix: 'Prefix'}}
          value="opt_one"
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );
      expect(screen.getByRole('button', {name: 'Prefix Option One'})).toBeInTheDocument();
    });

    it('can search', async function () {
      render(
        <CompactSelect
          searchable
          searchPlaceholder="Search here…"
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // type 'Two' into the search box
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('Two');

      // only Option Two should be available, Option One should be filtered out
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    });

    it('can limit the number of options', async function () {
      render(
        <CompactSelect
          sizeLimit={2}
          sizeLimitMessage="Use search for more options…"
          searchable
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
            {value: 'opt_three', label: 'Option Three'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // only the first two options should be visible due to `sizeLimit`
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: 'Option Three'})
      ).not.toBeInTheDocument();

      // there's a message prompting the user to use search to find more options
      expect(screen.getByText('Use search for more options…')).toBeInTheDocument();

      // Option Three is not reachable via keyboard, focus wraps back to Option One
      await userEvent.keyboard(`{ArrowDown}`);
      expect(screen.getByRole('option', {name: 'Option One'})).toHaveFocus();
      await userEvent.keyboard(`{ArrowDown>2}`);
      expect(screen.getByRole('option', {name: 'Option One'})).toHaveFocus();

      // Option Three is still available via search
      await userEvent.type(screen.getByPlaceholderText('Search…'), 'three');
      expect(screen.getByRole('option', {name: 'Option Three'})).toBeInTheDocument();

      // the size limit message is gone during search
      expect(screen.queryByText('Use search for more options…')).not.toBeInTheDocument();
    });

    it('can toggle sections', async function () {
      const mock = jest.fn();
      render(
        <CompactSelect
          multiple
          onSectionToggle={mock}
          options={[
            {
              key: 'section-1',
              label: 'Section 1',
              showToggleAllButton: true,
              options: [
                {value: 'opt_one', label: 'Option One'},
                {value: 'opt_two', label: 'Option Two'},
              ],
            },
            {
              key: 'section-2',
              label: 'Section 2',
              showToggleAllButton: true,
              options: [
                {value: 'opt_three', label: 'Option Three'},
                {value: 'opt_four', label: 'Option Four'},
              ],
            },
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button', {expanded: false}));
      await waitFor(() =>
        expect(screen.getByRole('option', {name: 'Option One'})).toHaveFocus()
      );

      // move focus to Section 1's toggle button and press it to select all
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Select All in Section 1'})).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('option', {name: 'Option One'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('option', {name: 'Option Two'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-1',
          label: 'Section 1',
          showToggleAllButton: true,
          options: [
            {key: 'opt_one', value: 'opt_one', label: 'Option One'},
            {key: 'opt_two', value: 'opt_two', label: 'Option Two'},
          ],
        },
        'select'
      );

      // press Section 1's toggle button again to unselect all
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('option', {name: 'Option One'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(screen.getByRole('option', {name: 'Option Two'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-1',
          label: 'Section 1',
          showToggleAllButton: true,
          options: [
            {key: 'opt_one', value: 'opt_one', label: 'Option One'},
            {key: 'opt_two', value: 'opt_two', label: 'Option Two'},
          ],
        },
        'unselect'
      );

      // move to Section 2's toggle button and select all
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Select All in Section 2'})).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('option', {name: 'Option Three'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('option', {name: 'Option Four'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-2',
          label: 'Section 2',
          showToggleAllButton: true,
          options: [
            {key: 'opt_three', value: 'opt_three', label: 'Option Three'},
            {key: 'opt_four', value: 'opt_four', label: 'Option Four'},
          ],
        },
        'select'
      );
    });

    it('triggers onClose when the menu is closed if provided', async function () {
      const onCloseMock = jest.fn();
      render(
        <CompactSelect
          onClose={onCloseMock}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));
      expect(onCloseMock).not.toHaveBeenCalled();

      // close the menu
      await userEvent.click(document.body);
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('GridList', function () {
    it('updates trigger label on selection', async function () {
      const mock = jest.fn();
      render(
        <CompactSelect
          grid
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          onChange={mock}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));

      expect(mock).toHaveBeenCalledWith({value: 'opt_one', label: 'Option One'});
      expect(screen.getByRole('button', {name: 'Option One'})).toBeInTheDocument();
    });

    it('can select multiple options', async function () {
      const mock = jest.fn();
      render(
        <CompactSelect
          grid
          multiple
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          onChange={mock}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One & Option Two
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.click(screen.getByRole('row', {name: 'Option Two'}));

      expect(mock).toHaveBeenCalledWith([
        {value: 'opt_one', label: 'Option One'},
        {value: 'opt_two', label: 'Option Two'},
      ]);
      expect(screen.getByRole('button', {name: 'Option One +1'})).toBeInTheDocument();
    });

    it('can select options with values containing quotes', async function () {
      const mock = jest.fn();
      render(
        <CompactSelect
          grid
          multiple
          options={[
            {value: '"opt_one"', label: 'Option One'},
            {value: '"opt_two"', label: 'Option Two'},
          ]}
          onChange={mock}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One & Option Two
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.click(screen.getByRole('row', {name: 'Option Two'}));

      expect(mock).toHaveBeenCalledWith([
        {value: '"opt_one"', label: 'Option One'},
        {value: '"opt_two"', label: 'Option Two'},
      ]);
    });

    it('displays trigger button with prefix', function () {
      render(
        <CompactSelect
          grid
          triggerProps={{prefix: 'Prefix'}}
          value="opt_one"
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );
      expect(screen.getByRole('button', {name: 'Prefix Option One'})).toBeInTheDocument();
    });

    it('can search', async function () {
      render(
        <CompactSelect
          grid
          searchable
          searchPlaceholder="Search here…"
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // type 'Two' into the search box
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('Two');

      // only Option Two should be available, Option One should be filtered out
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('row', {name: 'Option One'})).not.toBeInTheDocument();
    });

    it('can limit the number of options', async function () {
      render(
        <CompactSelect
          grid
          sizeLimit={2}
          sizeLimitMessage="Use search for more options…"
          searchable
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
            {value: 'opt_three', label: 'Option Three'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // only the first two options should be visible due to `sizeLimit`
      expect(screen.getByRole('row', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('row', {name: 'Option Three'})).not.toBeInTheDocument();

      // there's a message prompting the user to use search to find more options
      expect(screen.getByText('Use search for more options…')).toBeInTheDocument();

      // Option Three is not reachable via keyboard, focus wraps back to Option One
      await userEvent.keyboard(`{ArrowDown}`);
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus();
      await userEvent.keyboard(`{ArrowDown>2}`);
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus();

      // Option Three is still available via search
      await userEvent.type(screen.getByPlaceholderText('Search…'), 'three');
      expect(screen.getByRole('row', {name: 'Option Three'})).toBeInTheDocument();

      // the size limit message is gone during search
      expect(screen.queryByText('Use search for more options…')).not.toBeInTheDocument();
    });

    it('can toggle sections', async function () {
      const mock = jest.fn();
      render(
        <CompactSelect
          grid
          multiple
          onSectionToggle={mock}
          options={[
            {
              key: 'section-1',
              label: 'Section 1',
              showToggleAllButton: true,
              options: [
                {value: 'opt_one', label: 'Option One'},
                {value: 'opt_two', label: 'Option Two'},
              ],
            },
            {
              key: 'section-2',
              label: 'Section 2',
              showToggleAllButton: true,
              options: [
                {value: 'opt_three', label: 'Option Three'},
                {value: 'opt_four', label: 'Option Four'},
              ],
            },
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button', {expanded: false}));
      await waitFor(() =>
        expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus()
      );

      // move focus to Section 1's toggle button and press it to select all
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Select All in Section 1'})).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('row', {name: 'Option Two'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-1',
          label: 'Section 1',
          showToggleAllButton: true,
          options: [
            {key: 'opt_one', value: 'opt_one', label: 'Option One'},
            {key: 'opt_two', value: 'opt_two', label: 'Option Two'},
          ],
        },
        'select'
      );

      // press Section 1's toggle button again to unselect all
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(screen.getByRole('row', {name: 'Option Two'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-1',
          label: 'Section 1',
          showToggleAllButton: true,
          options: [
            {key: 'opt_one', value: 'opt_one', label: 'Option One'},
            {key: 'opt_two', value: 'opt_two', label: 'Option Two'},
          ],
        },
        'unselect'
      );

      // move to Section 2's toggle button and select all
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Select All in Section 2'})).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('row', {name: 'Option Three'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('row', {name: 'Option Four'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-2',
          label: 'Section 2',
          showToggleAllButton: true,
          options: [
            {key: 'opt_three', value: 'opt_three', label: 'Option Three'},
            {key: 'opt_four', value: 'opt_four', label: 'Option Four'},
          ],
        },
        'select'
      );
    });

    it('triggers onClose when the menu is closed if provided', async function () {
      const onCloseMock = jest.fn();
      render(
        <CompactSelect
          grid
          onClose={onCloseMock}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));
      expect(onCloseMock).not.toHaveBeenCalled();

      // close the menu
      await userEvent.click(document.body);
      expect(onCloseMock).toHaveBeenCalled();
    });

    it('allows keyboard navigation to nested buttons', async function () {
      const onPointerUpMock = jest.fn();
      const onKeyUpMock = jest.fn();

      render(
        <CompactSelect
          grid
          options={[
            {
              value: 'opt_one',
              label: 'Option One',
              trailingItems: (
                <button onPointerUp={onPointerUpMock} onKeyUp={onKeyUpMock}>
                  Trailing Button One
                </button>
              ),
            },
            {
              value: 'opt_two',
              label: 'Option Two',
              trailingItems: (
                <button onPointerUp={onPointerUpMock} onKeyUp={onKeyUpMock}>
                  Trailing Button Two
                </button>
              ),
            },
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() =>
        expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus()
      );

      // press Arrow Right, focus should be moved to the trailing button
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', {name: 'Trailing Button One'})).toHaveFocus();

      // press Enter, onKeyUpMock is called
      await userEvent.keyboard('{ArrowRight}');
      expect(onKeyUpMock).toHaveBeenCalled();

      // click on Trailing Button Two, onPointerUpMock is called
      await userEvent.click(screen.getByRole('button', {name: 'Trailing Button Two'}));
      expect(onPointerUpMock).toHaveBeenCalled();
    });
  });
});

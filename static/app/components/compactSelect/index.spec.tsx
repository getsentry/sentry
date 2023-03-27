import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CompactSelect} from 'sentry/components/compactSelect';

describe('CompactSelect', function () {
  it('renders', function () {
    const {container} = render(
      <CompactSelect
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(container).toSnapshot();
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

    it('can toggle sections', async function () {
      render(
        <CompactSelect
          multiple
          options={[
            {
              label: 'Section 1',
              showToggleAllButton: true,
              options: [
                {value: 'opt_one', label: 'Option One'},
                {value: 'opt_two', label: 'Option Two'},
              ],
            },
            {
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

    it('can toggle sections', async function () {
      render(
        <CompactSelect
          grid
          multiple
          options={[
            {
              label: 'Section 1',
              showToggleAllButton: true,
              options: [
                {value: 'opt_one', label: 'Option One'},
                {value: 'opt_two', label: 'Option Two'},
              ],
            },
            {
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
      await userEvent.click(screen.getByRole('button', {expanded: false}));
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

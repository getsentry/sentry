import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SegmentedControl} from 'sentry/components/segmentedControl';

describe('SegmentedControl', function () {
  it('renders with uncontrolled value', async function () {
    const onChange = jest.fn();
    render(
      <SegmentedControl aria-label="Test" defaultValue="1" onChange={onChange}>
        <SegmentedControl.Item key="1">Option 1</SegmentedControl.Item>
        <SegmentedControl.Item key="2">Option 2</SegmentedControl.Item>
        <SegmentedControl.Item key="3">Option 3</SegmentedControl.Item>
      </SegmentedControl>
    );

    // Radio group (wrapper) has the correct aria-label and aria-orientation
    expect(screen.getByRole('radiogroup')).toHaveAccessibleName('Test');
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );

    // All 3 radio options are rendered
    expect(screen.getByRole('radio', {name: 'Option 1'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Option 2'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Option 3'})).toBeInTheDocument();

    // First option is selected by default
    expect(screen.getByRole('radio', {name: 'Option 1'})).toBeChecked();

    // Click on second option
    await userEvent.click(screen.getByRole('radio', {name: 'Option 2'}));

    // onChange function is called with the new key
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('renders with controlled value', function () {
    const {rerender} = render(
      <SegmentedControl aria-label="Test" value="2">
        <SegmentedControl.Item key="1">Option 1</SegmentedControl.Item>
        <SegmentedControl.Item key="2">Option 2</SegmentedControl.Item>
        <SegmentedControl.Item key="3">Option 3</SegmentedControl.Item>
      </SegmentedControl>
    );
    // Second option is selected
    expect(screen.getByRole('radio', {name: 'Option 2'})).toBeChecked();

    rerender(
      <SegmentedControl aria-label="Test" value="3">
        <SegmentedControl.Item key="1">Option 1</SegmentedControl.Item>
        <SegmentedControl.Item key="2">Option 2</SegmentedControl.Item>
        <SegmentedControl.Item key="3">Option 3</SegmentedControl.Item>
      </SegmentedControl>
    );
    // Third option is selected upon rerender
    expect(screen.getByRole('radio', {name: 'Option 3'})).toBeChecked();
  });

  it('responds to mouse and keyboard events', async function () {
    const onChange = jest.fn();
    render(
      <SegmentedControl aria-label="Test" defaultValue="1" onChange={onChange}>
        <SegmentedControl.Item key="1">Option 1</SegmentedControl.Item>
        <SegmentedControl.Item key="2">Option 2</SegmentedControl.Item>
        <SegmentedControl.Item key="3">Option 3</SegmentedControl.Item>
      </SegmentedControl>
    );

    // Clicking on Option 2 selects it
    await userEvent.click(screen.getByRole('radio', {name: 'Option 2'}));
    expect(screen.getByRole('radio', {name: 'Option 2'})).toBeChecked();

    // onChange function is called with the new key
    expect(onChange).toHaveBeenCalledWith('2');

    // Pressing arrow left/right selects the previous/next option
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', {name: 'Option 1'})).toBeChecked();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', {name: 'Option 2'})).toBeChecked();

    // Pressing arrow up/down selects the previous/next option
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', {name: 'Option 1'})).toBeChecked();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', {name: 'Option 2'})).toBeChecked();

    // When the selection state reaches the end of the list, it circles back to the
    // first option
    await userEvent.keyboard('{ArrowRight>2}');
    expect(screen.getByRole('radio', {name: 'Option 1'})).toBeChecked();
  });

  it('works with disabled options', async function () {
    render(
      <SegmentedControl aria-label="Test">
        <SegmentedControl.Item key="1">Option 1</SegmentedControl.Item>
        <SegmentedControl.Item key="2" disabled>
          Option 2
        </SegmentedControl.Item>
        <SegmentedControl.Item key="3">Option 3</SegmentedControl.Item>
      </SegmentedControl>
    );

    expect(screen.getByRole('radio', {name: 'Option 2'})).toBeDisabled();

    // Clicking on the disabled option does not select it
    await userEvent.click(screen.getByRole('radio', {name: 'Option 2'}));
    expect(screen.getByRole('radio', {name: 'Option 2'})).not.toBeChecked();

    // The disabled option is skipped when using keyboard navigation
    await userEvent.click(screen.getByRole('radio', {name: 'Option 1'}));
    expect(screen.getByRole('radio', {name: 'Option 1'})).toBeChecked();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', {name: 'Option 3'})).toBeChecked();
  });
});

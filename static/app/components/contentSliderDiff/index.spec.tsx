import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as useDimensions from 'sentry/utils/useDimensions';

import {ContentSliderDiff, type ContentSliderDiffBodyProps} from '.';

const beforeHelpText = 'This is before help text';
const afterHelpText = 'This is after help text';

function MockComponent({
  onDragHandleMouseDown,
}: Pick<ContentSliderDiffBodyProps, 'onDragHandleMouseDown'>) {
  return (
    <Fragment>
      <ContentSliderDiff.Header>
        <ContentSliderDiff.BeforeLabel help={beforeHelpText} />
        <ContentSliderDiff.AfterLabel help={afterHelpText} />
      </ContentSliderDiff.Header>
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
        onDragHandleMouseDown={onDragHandleMouseDown}
      />
    </Fragment>
  );
}

describe('ContentSliderDiff', function () {
  it('renders tooltip when help is provided', async function () {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 300, height: 300});

    render(<MockComponent />);

    // Before Tooltip
    await userEvent.hover(screen.getAllByTestId('more-information')[0]!);
    expect(await screen.findByText(beforeHelpText)).toBeInTheDocument();

    // After Tooltip
    await userEvent.hover(screen.getAllByTestId('more-information')[1]!);
    expect(await screen.findByText(afterHelpText)).toBeInTheDocument();
  });

  it('divider can be dragged', async function () {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 300, height: 300});

    const mockDragHandleMouseDown = jest.fn();

    render(<MockComponent onDragHandleMouseDown={mockDragHandleMouseDown} />);

    // Ensure that 'Before' and 'After' labels are rendered correctly
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();

    const dragHandle = screen.getByTestId('drag-handle');

    // Simulate dragging the divider
    await userEvent.pointer([
      {keys: '[MouseLeft>]', target: dragHandle, coords: {x: 0, y: 5}},
      {target: dragHandle, coords: {x: 10, y: 5}},
    ]);

    expect(mockDragHandleMouseDown).toHaveBeenCalledTimes(1);
  });

  it('does not render content when dimensions are zero', function () {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 0, height: 0});

    render(<MockComponent />);

    expect(screen.queryByTestId('before-content')).not.toBeInTheDocument();
  });
});

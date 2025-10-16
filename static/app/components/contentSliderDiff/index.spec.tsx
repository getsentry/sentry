import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as useDimensions from 'sentry/utils/useDimensions';

import {ContentSliderDiff} from '.';

describe('ContentSliderDiff', () => {
  it('divider can be dragged', async () => {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 300, height: 300});

    const mockDragHandleMouseDown = jest.fn();

    render(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
        onDragHandleMouseDown={mockDragHandleMouseDown}
      />
    );

    const dragHandle = screen.getByTestId('drag-handle');

    // Simulate dragging the divider
    await userEvent.pointer([
      {keys: '[MouseLeft>]', target: dragHandle, coords: {x: 0, y: 5}},
      {target: dragHandle, coords: {x: 10, y: 5}},
    ]);

    expect(mockDragHandleMouseDown).toHaveBeenCalledTimes(1);
  });

  it('does not render content when dimensions are zero', () => {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 0, height: 0});

    render(
      <ContentSliderDiff.Body
        before={<div>Before Content</div>}
        after={<div>After Content</div>}
      />
    );

    expect(screen.queryByTestId('before-content')).not.toBeInTheDocument();
  });
});

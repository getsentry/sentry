import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as useDimensions from 'sentry/utils/useDimensions';

import {ContentSliderDiff} from '.';

describe('ContentSliderDiff', function () {
  it('renders tooltip when help is provided', async function () {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 300, height: 300});

    const beforeHelpText = 'This is beforehelp text';
    const afterHelpText = 'This is after help text';

    render(
      <ContentSliderDiff
        beforeContent={<div>Before Content</div>}
        afterContent={<div>After Content</div>}
        beforeHelp={beforeHelpText}
        afterHelp={afterHelpText}
      />
    );

    // Before Tooltip
    await userEvent.hover(screen.getAllByTestId('more-information')[0]!);
    expect(await screen.findByText(beforeHelpText)).toBeInTheDocument();

    // After Tooltip
    await userEvent.hover(screen.getAllByTestId('more-information')[1]!);
    expect(await screen.findByText(afterHelpText)).toBeInTheDocument();
  });

  it('divider can be dragged', async function () {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 300, height: 300});

    const mockOnDividerMouseDown = jest.fn();

    render(
      <ContentSliderDiff
        beforeContent={<div>Before Content</div>}
        afterContent={<div>After Content</div>}
        onDividerMouseDown={mockOnDividerMouseDown}
      />
    );

    // Ensure that 'Before' and 'After' labels are rendered correctly
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();

    const divider = screen.getByTestId('divider');

    // Simulate dragging the divider
    await userEvent.pointer([
      {keys: '[MouseLeft>]', target: divider, coords: {x: 0, y: 5}},
      {target: divider, coords: {x: 10, y: 5}},
    ]);

    expect(mockOnDividerMouseDown).toHaveBeenCalledTimes(1);
  });

  it('does not render content when dimensions are zero', function () {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 0, height: 0});

    render(
      <ContentSliderDiff
        beforeContent={<div>Before Content</div>}
        afterContent={<div>After Content</div>}
      />
    );

    expect(screen.queryByTestId('before-content')).not.toBeInTheDocument();
  });
});

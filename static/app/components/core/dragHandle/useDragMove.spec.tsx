import {dragHandle} from 'sentry-test/dragMove';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useDragMove} from '@sentry/scraps/dragHandle';

function TestHandle({onMove = jest.fn()}: {onMove?: (delta: number) => void}) {
  const {isHeld, moveProps} = useDragMove({onMove, orientation: 'horizontal'});

  return <div {...moveProps} data-is-held={isHeld} data-test-id="handle" tabIndex={0} />;
}

const handle = () => screen.getByTestId('handle');

describe('useDragMove', () => {
  it('reports the distance dragged along the axis', () => {
    const onMove = jest.fn();
    render(<TestHandle onMove={onMove} />);

    dragHandle(handle(), {from: 100, to: 160});

    expect(onMove).toHaveBeenCalledWith(60);
  });

  it.each([
    {name: 'steps by 10 when arrowed', keys: '{ArrowRight}', expected: 10},
    {
      name: 'steps by 50 when shift is held',
      keys: '{Shift>}{ArrowRight}{/Shift}',
      expected: 50,
    },
  ])('$name', async ({keys, expected}) => {
    const onMove = jest.fn();
    render(<TestHandle onMove={onMove} />);

    await userEvent.tab();
    await userEvent.keyboard(keys);

    expect(onMove).toHaveBeenCalledWith(expected);
  });

  it('ignores arrow keys across the drag axis', async () => {
    const onMove = jest.fn();
    render(<TestHandle onMove={onMove} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');

    expect(onMove).not.toHaveBeenCalled();
  });

  it('suppresses hover and selection on the document while dragging', () => {
    render(<TestHandle />);

    dragHandle(handle(), {from: 100, to: 160, release: false});

    expect(document.body).toHaveStyle({pointerEvents: 'none'});
  });

  it('restores the document once the drag ends', () => {
    render(<TestHandle />);

    dragHandle(handle(), {from: 100, to: 160});

    expect(document.body).toHaveStyle({pointerEvents: ''});
  });

  it('restores the document when unmounted mid-drag', () => {
    const {unmount} = render(<TestHandle />);

    dragHandle(handle(), {from: 100, to: 160, release: false});
    unmount();

    expect(document.body).toHaveStyle({pointerEvents: ''});
  });
});

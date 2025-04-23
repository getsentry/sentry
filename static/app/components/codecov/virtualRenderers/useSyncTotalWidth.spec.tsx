import {useRef} from 'react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSyncTotalWidth} from './useSyncTotalWidth';

window.requestAnimationFrame = cb => {
  cb(1);
  return 1;
};
window.cancelAnimationFrame = () => {};

const scrollToMock = jest.fn();
window.scrollTo = scrollToMock;
window.scrollY = 100;

class ResizeObserverMock {
  callback = (_x: any) => null;

  constructor(callback: any) {
    this.callback = callback;
  }

  observe() {
    this.callback([
      {
        contentRect: {width: 100},
        target: {
          scrollWidth: 100,
          getAttribute: () => ({scrollWidth: 100}),
          getBoundingClientRect: () => ({top: 100}),
        },
      },
    ]);
  }
  unobserve() {
    // do nothing
  }
  disconnect() {
    // do nothing
  }
}
global.window.ResizeObserver = ResizeObserverMock;

function TestComponent() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const widthDivRef = useRef<HTMLDivElement>(null);
  useSyncTotalWidth(textAreaRef, widthDivRef);

  return (
    <div>
      <textarea data-test-id="text-area" style={{width: '100px'}} ref={textAreaRef} />
      <div data-test-id="width-div" style={{width: '0px'}} ref={widthDivRef} />
    </div>
  );
}

describe('useSyncTotalWidth', () => {
  it('should update the width of the width div to the width of the text area', async () => {
    render(<TestComponent />);

    const widthDiv = screen.getByTestId('width-div');
    await waitFor(() => expect(widthDiv).toHaveStyle({width: '100px'}));
  });
});

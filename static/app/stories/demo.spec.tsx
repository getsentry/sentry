import screenfull from 'screenfull';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Demo} from './demo';

jest.mock('screenfull', () => {
  let isFullscreen = false;
  let onChange: (() => void) | undefined;

  return {
    isEnabled: true,
    get isFullscreen() {
      return isFullscreen;
    },
    request: jest.fn(),
    exit: jest.fn(),
    on: jest.fn((event: string, callback: () => void) => {
      if (event === 'change') {
        onChange = callback;
      }
    }),
    off: jest.fn((event: string, callback: () => void) => {
      if (event === 'change' && callback === onChange) {
        onChange = undefined;
      }
    }),
    setFullscreen(value: boolean) {
      isFullscreen = value;
      onChange?.();
    },
  };
});

const mockScreenfull = screenfull as Omit<typeof screenfull, 'request'> & {
  request: jest.Mock;
  setFullscreen: (value: boolean) => void;
};

describe('Demo', () => {
  beforeEach(() => {
    mockScreenfull.setFullscreen(false);
  });

  it('opens a resizable demo in full screen', async () => {
    render(<Demo resizable>Responsive content</Demo>);

    await userEvent.click(screen.getByRole('button', {name: 'Enter full screen'}));

    expect(mockScreenfull.request).toHaveBeenCalledWith(expect.any(HTMLElement), {
      navigationUI: 'auto',
    });
    expect(mockScreenfull.request.mock.calls[0]?.[0]).toContainElement(
      screen.getByText('Responsive content')
    );
  });

  it('shows the heading breadcrumb in full screen', async () => {
    render(
      <div>
        <h1 id="container">Container</h1>
        <h3 id="usage">Usage</h3>
        <h4 id="container-queries">Container Queries</h4>
        <Demo resizable>Responsive content</Demo>
      </div>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Enter full screen'}));
    act(() => mockScreenfull.setFullscreen(true));

    const fullscreenTarget = mockScreenfull.request.mock.calls[0]?.[0];
    expect(
      within(fullscreenTarget).getByRole('link', {name: 'Container'})
    ).toHaveAttribute('href', '/mock-pathname/#container');
    expect(within(fullscreenTarget).getByRole('link', {name: 'Usage'})).toHaveAttribute(
      'href',
      '/mock-pathname/#usage'
    );
    expect(within(fullscreenTarget).getByText('Container Queries')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Exit full screen'})).toBeInTheDocument();
  });
});

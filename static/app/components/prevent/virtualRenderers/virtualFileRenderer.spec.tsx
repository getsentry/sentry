import * as Sentry from '@sentry/react';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {CoverageMap} from 'sentry/components/prevent/virtualRenderers/constants';

import {VirtualFileRenderer} from './virtualFileRenderer';

jest.mock('@sentry/react', () => {
  const originalModule = jest.requireActual('@sentry/react');
  return {
    ...originalModule,
    withProfiler: jest.fn(),
    captureMessage: jest.fn(),
  };
});

window.requestAnimationFrame = cb => {
  cb(1);
  return 1;
};
window.cancelAnimationFrame = () => {};

const scrollToMock = jest.fn();
window.scrollTo = scrollToMock;
window.scrollY = 100;

let scrollWidth = 100;
let clientWidth = 100;

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
          scrollWidth,
          clientWidth,
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

const code = `<Breadcrumb
    paths={[
    { pageName: 'owner', text: owner },
    { pageName: 'repo', text: repo },
    ...treePaths,
    {..props}
    ]}
/>`;

const coverageData: CoverageMap = {
  1: 'H',
  2: 'M',
  3: 'P',
};

describe('VirtualFileRenderer', () => {
  let requestAnimationFrameSpy: jest.SpyInstance;
  let cancelAnimationFrameSpy: jest.SpyInstance;
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    requestAnimationFrameSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(cb => {
        setTimeout(() => {
          cb(1);
        }, 50);
        return 1;
      });
    cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame');
    dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementationOnce(() => 1000)
      .mockImplementationOnce(() => 2000);
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    dateNowSpy.mockRestore();
    jest.clearAllMocks();
  });

  function setup() {
    const user = userEvent.setup();

    return {user};
  }

  it('renders the text-area', () => {
    render(<VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />);

    const textArea = screen.getByTestId('virtual-file-renderer-text-area');
    expect(textArea).toBeInTheDocument();

    const codeBlock = within(textArea).getByText(/Breadcrumb/);
    expect(codeBlock).toBeInTheDocument();
  });

  describe('virtualized list', () => {
    describe('valid language', () => {
      it('renders code in virtualized list', () => {
        render(
          <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
        );

        const virtualOverlay = screen.getByTestId('virtual-file-renderer-overlay');
        expect(virtualOverlay).toBeInTheDocument();

        const codeBlock = within(virtualOverlay).getByText(/Breadcrumb/);
        expect(codeBlock).toBeInTheDocument();
      });
    });

    describe('invalid language', () => {
      it('renders code in virtualized list', () => {
        render(
          <VirtualFileRenderer
            content={code}
            coverage={coverageData}
            fileName="random-file-type"
          />
        );

        const virtualOverlay = screen.getByTestId('virtual-file-renderer-overlay');
        expect(virtualOverlay).toBeInTheDocument();

        const codeBlock = within(virtualOverlay).getByText(/Breadcrumb/);
        expect(codeBlock).toBeInTheDocument();
      });
    });
  });

  it('renders line numbers', () => {
    render(<VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />);

    const lineNumbers = screen.getAllByText(/\d+/);
    expect(lineNumbers).toHaveLength(8);
  });

  describe('covered lines', () => {
    it('applies coverage background', () => {
      render(
        <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
      );

      const virtualOverlay = screen.getByTestId('virtual-file-renderer-overlay');
      expect(virtualOverlay).toBeInTheDocument();

      const coveredLine = screen.getByLabelText('covered line');
      expect(coveredLine).toBeInTheDocument();
    });
  });

  describe('uncovered lines', () => {
    it('applies missing coverage background', () => {
      render(
        <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
      );

      const virtualOverlay = screen.getByTestId('virtual-file-renderer-overlay');
      expect(virtualOverlay).toBeInTheDocument();

      const uncovered = screen.getByLabelText('missed line');
      expect(uncovered).toBeInTheDocument();
    });
  });

  describe('partial lines', () => {
    it('applies partial coverage background', () => {
      render(
        <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
      );

      const virtualOverlay = screen.getByTestId('virtual-file-renderer-overlay');
      expect(virtualOverlay).toBeInTheDocument();

      const partial = screen.getByLabelText('partial line');
      expect(partial).toBeInTheDocument();
    });
  });

  describe('toggling pointer events', () => {
    it('disables pointer events on scroll and resets after timeout', async () => {
      render(
        <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
      );

      const lines = await screen.findAllByText(/{ pageName: 'repo', text: repo },/);
      expect(lines[0]).toBeInTheDocument();

      fireEvent.scroll(window, {target: {scrollX: 100}});

      const codeRenderer = screen.getByTestId('virtual-file-renderer');
      await waitFor(() => expect(codeRenderer).toHaveStyle('pointer-events: none'));
      await waitFor(() => expect(codeRenderer).toHaveStyle('pointer-events: auto'));
    });

    it('calls cancelAnimationFrame', async () => {
      const {container} = render(
        <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
      );

      const lines = await screen.findAllByText(/{ pageName: 'repo', text: repo },/);
      expect(lines[0]).toBeInTheDocument();

      fireEvent.scroll(window, {target: {scrollX: 100}});

      // eslint-disable-next-line testing-library/no-container
      container.remove();
      fireEvent.scroll(window, {target: {scrollX: 100}});
      fireEvent.scroll(window, {target: {scrollX: 100}});

      await waitFor(() => expect(cancelAnimationFrameSpy).toHaveBeenCalled());
    });
  });

  describe('highlighted line', () => {
    describe('user clicks on line number', () => {
      it('updates the URL', async () => {
        const {user} = setup();
        const {router} = render(
          <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
        );

        const line = screen.getByText(1);
        await user.click(line);

        await waitFor(() => expect(router.location.hash).toBe('#L1'));
      });

      it('highlights the line on click', async () => {
        const {user} = setup();
        render(
          <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
        );

        const line = screen.getByText(1);
        await user.click(line);

        const bar = await screen.findByLabelText('highlighted line');
        expect(bar).toBeInTheDocument();
      });

      it('removes highlighting when clicking on highlighted line', async () => {
        const {user} = setup();
        const {router} = render(
          <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
        );

        const line = screen.getByText(1);
        await user.click(line);
        await waitFor(() => expect(router.location.hash).toBe('#L1'));
        await user.click(line);
        await waitFor(() => expect(router.location.hash).toBe(''));
      });
    });
  });

  describe('scroll to line', () => {
    describe('valid line number', () => {
      it('calls scrollTo', async () => {
        render(
          <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />,
          {
            initialRouterConfig: {
              location: {
                pathname: '/#L4',
              },
            },
          }
        );

        await waitFor(() => expect(scrollToMock).toHaveBeenCalled());
      });
    });

    describe('invalid line number', () => {
      it('captures message to sentry', async () => {
        render(
          <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />,
          {
            initialRouterConfig: {
              location: {
                pathname: '/#RandomNumber',
              },
            },
          }
        );
        await waitFor(() => {
          expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'Invalid line number in file renderer hash: #RandomNumber',
            {fingerprint: ['file-renderer-invalid-line-number']}
          );
        });
      });
    });
  });

  describe('horizontal scroll', () => {
    it('syncs code display with text area scroll', async () => {
      render(
        <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
      );

      const textArea = screen.getByTestId('virtual-file-renderer-text-area');
      fireEvent.scroll(textArea, {
        target: {scrollLeft: 100},
      });

      const virtualOverlay = screen.getByTestId('virtual-file-renderer-overlay');
      await waitFor(() => expect(virtualOverlay.scrollLeft).toBe(100));
    });
  });

  describe('testing overflowing lines', () => {
    describe('overflowing lines', () => {
      beforeEach(() => {
        scrollWidth = 200;
        clientWidth = 100;
      });

      it('renders the scrollbar', () => {
        render(
          <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
        );

        const scrollBar = screen.getByTestId('virtual-renderer-scroll-bar');
        expect(scrollBar).toBeInTheDocument();
      });
    });

    describe('does not overflow', () => {
      beforeEach(() => {
        scrollWidth = 100;
        clientWidth = 100;
      });

      it('does not render the scrollbar', () => {
        render(
          <VirtualFileRenderer content={code} coverage={coverageData} fileName="tsx" />
        );

        const scrollBar = screen.queryByTestId('virtual-renderer-scroll-bar');
        expect(scrollBar).not.toBeInTheDocument();
      });
    });
  });
});

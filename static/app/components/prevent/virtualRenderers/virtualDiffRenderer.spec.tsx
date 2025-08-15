import * as Sentry from '@sentry/react';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {VirtualDiffRenderer, type LineData} from './virtualDiffRenderer';

jest.mock('@sentry/react', () => {
  const originalModule = jest.requireActual('@sentry/react');
  return {
    ...originalModule,
    withProfiler: (component: any) => component,
    captureMessage: jest.fn(),
  };
});

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
          clientWidth: 100,
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

const lineData: LineData[] = [
  {headNumber: '1', baseNumber: '2', headCoverage: 'H', baseCoverage: 'H'},
  {headNumber: '3', baseNumber: '4', headCoverage: 'M', baseCoverage: 'M'},
  {headNumber: '5', baseNumber: '6', headCoverage: 'P', baseCoverage: 'P'},
  {headNumber: '7', baseNumber: '8', headCoverage: null, baseCoverage: null},
  {headNumber: '9', baseNumber: '10', headCoverage: null, baseCoverage: null},
  {headNumber: '11', baseNumber: '12', headCoverage: null, baseCoverage: null},
  {headNumber: '13', baseNumber: '14', headCoverage: null, baseCoverage: null},
  {headNumber: '15', baseNumber: '16', headCoverage: null, baseCoverage: null},
];

describe('VirtualFileRenderer', () => {
  let requestAnimationFrameSpy: jest.SpyInstance;
  let cancelAnimationFrameSpy: jest.SpyInstance;
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    requestAnimationFrameSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
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
    render(
      <VirtualDiffRenderer
        content={code}
        lineData={lineData}
        fileName="tsx"
        hashedPath="hashedPath"
      />,
      {}
    );

    const textArea = screen.getByTestId('virtual-diff-renderer-text-area');
    expect(textArea).toBeInTheDocument();

    const codeBlock = within(textArea).getByText(/Breadcrumb/);
    expect(codeBlock).toBeInTheDocument();
  });

  describe('virtualized list', () => {
    describe('valid language', () => {
      it('renders code in virtualized list', () => {
        render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />,
          {}
        );

        const virtualOverlay = screen.getByTestId('virtual-diff-renderer-overlay');
        expect(virtualOverlay).toBeInTheDocument();

        const codeBlock = within(virtualOverlay).getByText(/Breadcrumb/);
        expect(codeBlock).toBeInTheDocument();
      });
    });

    describe('invalid language', () => {
      it('renders code in virtualized list', () => {
        render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="random-file-type"
            hashedPath="hashedPath"
          />,
          {}
        );

        const virtualOverlay = screen.getByTestId('virtual-diff-renderer-overlay');
        expect(virtualOverlay).toBeInTheDocument();

        const codeBlock = within(virtualOverlay).getByText(/Breadcrumb/);
        expect(codeBlock).toBeInTheDocument();
      });
    });
  });

  it('renders line numbers', () => {
    render(
      <VirtualDiffRenderer
        content={code}
        lineData={lineData}
        fileName="tsx"
        hashedPath="hashedPath"
      />,
      {}
    );

    const lineNumbers = screen.getAllByText(/\d+/);
    // 2 * total lines
    expect(lineNumbers).toHaveLength(16);
  });

  describe('covered lines', () => {
    it('applies hit coverage labels', () => {
      render(
        <VirtualDiffRenderer
          content={code}
          lineData={lineData}
          fileName="tsx"
          hashedPath="hashedPath"
        />,
        {}
      );

      const coverageHitBaseLineNumber = screen.getByLabelText('hit base line');
      expect(coverageHitBaseLineNumber).toBeInTheDocument();

      const coverageHitHeadLineNumber = screen.getByLabelText('hit head line');
      expect(coverageHitHeadLineNumber).toBeInTheDocument();
    });
  });

  describe('uncovered lines', () => {
    it('applies missing coverage labels', () => {
      render(
        <VirtualDiffRenderer
          content={code}
          lineData={lineData}
          fileName="tsx"
          hashedPath="hashedPath"
        />,
        {}
      );

      const coverageMissedBaseLineNumber = screen.getByLabelText('missed base line');
      expect(coverageMissedBaseLineNumber).toBeInTheDocument();

      const coverageMissedHeadLineNumber = screen.getByLabelText('missed head line');
      expect(coverageMissedHeadLineNumber).toBeInTheDocument();
    });
  });

  describe('partial lines', () => {
    it('applies partial coverage labels', () => {
      render(
        <VirtualDiffRenderer
          content={code}
          lineData={lineData}
          fileName="tsx"
          hashedPath="hashedPath"
        />,
        {}
      );

      const coveragePartialBaseLineNumber = screen.getByLabelText('partial base line');
      expect(coveragePartialBaseLineNumber).toBeInTheDocument();

      const coveragePartialHeadLineNumber = screen.getByLabelText('partial head line');
      expect(coveragePartialHeadLineNumber).toBeInTheDocument();
    });
  });

  describe('toggling pointer events', () => {
    it('disables pointer events on scroll and resets after timeout', async () => {
      render(
        <VirtualDiffRenderer
          content={code}
          lineData={lineData}
          fileName="tsx"
          hashedPath="hashedPath"
        />,
        {}
      );

      const lines = await screen.findAllByText(/{ pageName: 'repo', text: repo },/);
      expect(lines[0]).toBeInTheDocument();

      fireEvent.scroll(window, {target: {scrollX: 100}});

      const codeRenderer = screen.getByTestId('virtual-diff-renderer');
      await waitFor(() => expect(codeRenderer).toHaveStyle('pointer-events: none'));
      await waitFor(() => expect(codeRenderer).toHaveStyle('pointer-events: auto'));
    });

    it('calls cancelAnimationFrame', async () => {
      const {container} = render(
        <VirtualDiffRenderer
          content={code}
          lineData={lineData}
          fileName="tsx"
          hashedPath="hashedPath"
        />,
        {}
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
    describe('user clicks on base number', () => {
      it('updates the URL', async () => {
        const {user} = setup();
        const {router} = render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />
        );

        const line = screen.getByText(2);
        await user.click(line);

        await waitFor(() => expect(router.location.hash).toBe('#hashedPath-L2'));
      });

      it('highlights the line on click', async () => {
        const {user} = setup();
        render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />
        );

        const line = screen.getByText(2);
        await user.click(line);

        const bar = await screen.findByLabelText('highlighted base line');
        expect(bar).toBeInTheDocument();
      });

      it('removes highlighting when clicking on highlighted line', async () => {
        const {user} = setup();
        const {router} = render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />
        );

        const line = screen.getByText(1);
        await user.click(line);
        await waitFor(() => expect(router.location.hash).toBe('#hashedPath-R1'));
        await user.click(line);
        await waitFor(() => expect(router.location.hash).toBe(''));
      });
    });

    describe('user clicks on head number', () => {
      it('updates the URL', async () => {
        const {user} = setup();
        const {router} = render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />
        );

        const line = screen.getByText(1);
        await user.click(line);

        await waitFor(() => expect(router.location.hash).toBe('#hashedPath-R1'));
      });

      it('highlights the line on click', async () => {
        const {user} = setup();
        render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />
        );

        const line = screen.getByText(1);
        await user.click(line);

        const bar = await screen.findByLabelText('highlighted head line');
        expect(bar).toBeInTheDocument();
      });

      it('removes highlighting when clicking on highlighted line', async () => {
        const {user} = setup();
        const {router} = render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />
        );

        const line = screen.getByText(1);
        await user.click(line);
        await waitFor(() => expect(router.location.hash).toBe('#hashedPath-R1'));
        await user.click(line);
        await waitFor(() => expect(router.location.hash).toBe(''));
      });
    });
  });

  describe('scroll to line', () => {
    describe('valid line number', () => {
      it('calls scrollTo', async () => {
        render(
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />,
          {
            initialRouterConfig: {
              location: {
                pathname: '/#hashedPath-L4',
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
          <VirtualDiffRenderer
            content={code}
            lineData={lineData}
            fileName="tsx"
            hashedPath="hashedPath"
          />,
          {
            initialRouterConfig: {
              location: {
                pathname: '/#hashedPath-RRandomNumber',
              },
            },
          }
        );

        await waitFor(() => {
          expect(Sentry.captureMessage).toHaveBeenCalledWith(
            'Invalid line number in diff renderer hash: #hashedPath-RRandomNumber',
            {fingerprint: ['diff-renderer-invalid-line-number']}
          );
        });
      });
    });
  });

  describe('horizontal scroll', () => {
    it('syncs code display with text area scroll', async () => {
      render(
        <VirtualDiffRenderer
          content={code}
          lineData={lineData}
          fileName="tsx"
          hashedPath="hashedPath"
        />,
        {}
      );

      const textArea = screen.getByTestId('virtual-diff-renderer-text-area');
      fireEvent.scroll(textArea, {
        target: {scrollLeft: 100},
      });

      const virtualOverlay = screen.getByTestId('virtual-diff-renderer-overlay');
      await waitFor(() => expect(virtualOverlay.scrollLeft).toBe(100));
    });
  });
});

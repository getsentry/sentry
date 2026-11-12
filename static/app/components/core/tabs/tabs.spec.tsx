import {useLocation} from 'react-router';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {TabList, Tabs} from '@sentry/scraps/tabs';

const TABS = [
  {key: 'details', label: 'Details', content: 'So by colonel hearted ferrars.'},
  {
    key: 'activity',
    label: 'Activity',
    content:
      'Draw from upon here gone add one. He in sportsman household otherwise it perceived instantly.',
  },
  {
    key: 'user-feedback',
    label: 'User Feedback',
    content: 'Is inquiry no he several excited am.',
  },
  {
    key: 'attachments',
    label: 'Attachments',
    content: 'Called though excuse length ye needed it he having.',
  },
] as const;

function LinkedTabs({
  value,
  onChange,
  keyboardActivation = 'manual',
  disabled,
}: {
  disabled?: boolean;
  keyboardActivation?: 'manual' | 'automatic';
  onChange?: (key: string) => void;
  value?: string;
}) {
  return (
    <Tabs
      defaultValue="details"
      value={value}
      onChange={onChange}
      keyboardActivation={keyboardActivation}
      disabled={disabled}
    >
      <TabList>
        {TABS.map(tab => (
          <TabList.Item key={tab.key} to={`/tabs/${tab.key}/`}>
            {tab.label}
          </TabList.Item>
        ))}
      </TabList>
    </Tabs>
  );
}

function RoutedTabs({onChange}: {onChange: (key: string) => void}) {
  const {pathname} = useLocation();
  return <LinkedTabs value={pathname.split('/')[2]} onChange={onChange} />;
}

describe('Tabs routing', () => {
  it.each(['{Enter}', ' '])('navigates to the focused tab with %s', async key => {
    const onChange = jest.fn();
    const {router} = render(<LinkedTabs onChange={onChange} />, {
      initialRouterConfig: {location: {pathname: '/tabs/details/'}},
    });

    await userEvent.tab();
    onChange.mockClear();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveFocus();
    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'href',
      '/tabs/activity/'
    );
    expect(router.location.pathname).toBe('/tabs/details/');
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.keyboard(key);

    await waitFor(() => expect(router.location.pathname).toBe('/tabs/activity/'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('activity');

    router.navigate(-1);
    await waitFor(() => expect(router.location.pathname).toBe('/tabs/details/'));
  });

  it('navigates once when a tab link is clicked', async () => {
    const onChange = jest.fn();
    const {router} = render(<LinkedTabs onChange={onChange} />, {
      initialRouterConfig: {location: {pathname: '/tabs/details/'}},
    });

    await userEvent.click(screen.getByRole('tab', {name: 'Activity'}));

    await waitFor(() => expect(router.location.pathname).toBe('/tabs/activity/'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('activity');

    router.navigate(-1);
    await waitFor(() => expect(router.location.pathname).toBe('/tabs/details/'));
  });

  it.each(['MetaLeft', 'ControlLeft', 'ShiftLeft', 'AltLeft'])(
    'does not change selection or navigate locally on a %s click',
    async modifier => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      const {router} = render(<LinkedTabs onChange={onChange} />, {
        initialRouterConfig: {location: {pathname: '/tabs/details/'}},
      });

      const preventNativeNavigation = jest.fn((event: MouseEvent) => {
        expect(event.defaultPrevented).toBe(false);
        event.preventDefault();
      });
      document.addEventListener('click', preventNativeNavigation);
      try {
        await user.keyboard(`[${modifier}>]`);
        await user.click(screen.getByRole('tab', {name: 'Activity'}));
        await user.keyboard(`[/${modifier}]`);
      } finally {
        document.removeEventListener('click', preventNativeNavigation);
      }

      expect(preventNativeNavigation).toHaveBeenCalledTimes(1);
      expect(router.location.pathname).toBe('/tabs/details/');
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('tab', {name: 'Details'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
    }
  );

  it('does not navigate on automatic keyboard selection until the link is activated', async () => {
    const onChange = jest.fn();
    const {router} = render(
      <LinkedTabs keyboardActivation="automatic" onChange={onChange} />,
      {initialRouterConfig: {location: {pathname: '/tabs/details/'}}}
    );

    await userEvent.tab();
    onChange.mockClear();
    await userEvent.keyboard('{ArrowRight}');

    expect(router.location.pathname).toBe('/tabs/details/');
    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('activity');

    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(router.location.pathname).toBe('/tabs/activity/'));
    router.navigate(-1);
    await waitFor(() => expect(router.location.pathname).toBe('/tabs/details/'));
  });

  it('does not render navigable links when all tabs are disabled', async () => {
    const {router} = render(<LinkedTabs disabled />, {
      initialRouterConfig: {location: {pathname: '/tabs/details/'}},
    });

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-disabled', 'true');
      expect(tab).not.toHaveAttribute('href');
      await userEvent.click(tab);
    }
    expect(router.location.pathname).toBe('/tabs/details/');
  });

  it('does not navigate when the controlled value changes', () => {
    const onChange = jest.fn();
    const {router, rerender} = render(
      <LinkedTabs value="details" onChange={onChange} />,
      {
        initialRouterConfig: {location: {pathname: '/tabs/details/'}},
      }
    );

    rerender(<LinkedTabs value="activity" onChange={onChange} />);

    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(router.location.pathname).toBe('/tabs/details/');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Tabs overflow routing', () => {
  // Every tab measures this wide; the container width is varied per test to
  // control how many tabs fit. The component reserves 48px for the trigger.
  const TAB_WIDTH = 100;

  // Widths reported by each tab and by the tab list wrapper, mutable so resizes
  // can be simulated. jsdom has no layout engine, so all measurement is mocked.
  let tabWidth = TAB_WIDTH;
  let containerWidth = 1000;
  let resizeCallbacks: ResizeObserverCallback[] = [];
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    tabWidth = TAB_WIDTH;
    containerWidth = 1000;
    resizeCallbacks = [];

    // Each tab (<li role="tab">) measures tabWidth and the tab list wrapper
    // (whose direct child is the tablist) measures containerWidth; everything
    // else is 0.
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        let width = 0;
        if (
          this.getAttribute('role') === 'tab' ||
          this.querySelector(':scope > [role="tab"]')
        ) {
          width = tabWidth;
        } else if (this.querySelector(':scope > [role="tablist"]')) {
          width = containerWidth;
        }
        return {
          width,
          height: 0,
          top: 0,
          bottom: 0,
          left: 0,
          right: width,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });

    // Controllable ResizeObserver so resizes can be triggered on demand (the
    // global mock is a no-op).
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.ResizeObserver = originalResizeObserver;
  });

  it.each(['click', 'keyboard'])(
    'navigates once to an overflowing link by %s',
    async interaction => {
      containerWidth = 260;
      const onChange = jest.fn();
      const {router} = render(<RoutedTabs onChange={onChange} />, {
        initialRouterConfig: {location: {pathname: '/tabs/details/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'More tabs'}));
      const item = screen.getByRole('menuitemradio', {name: 'User Feedback'});
      expect(item).toHaveAttribute('href', '/tabs/user-feedback/');

      if (interaction === 'click') {
        await userEvent.click(item);
      } else {
        await userEvent.keyboard('{Enter}');
      }

      await waitFor(() => expect(router.location.pathname).toBe('/tabs/user-feedback/'));
      expect(
        screen.getByRole('tab', {name: 'User Feedback', hidden: true})
      ).toHaveAttribute('aria-selected', 'true');
      expect(onChange).not.toHaveBeenCalled();

      router.navigate(-1);
      await waitFor(() => expect(router.location.pathname).toBe('/tabs/details/'));
      expect(screen.getByRole('tab', {name: 'Details'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
    }
  );

  it('preserves selection when an overflowing link is opened with a modifier', async () => {
    const user = userEvent.setup();
    containerWidth = 260;
    const onChange = jest.fn();
    const {router} = render(<LinkedTabs onChange={onChange} />, {
      initialRouterConfig: {location: {pathname: '/tabs/details/'}},
    });

    await user.click(screen.getByRole('button', {name: 'More tabs'}));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await user.keyboard('[MetaLeft>]');
      await user.click(screen.getByRole('menuitemradio', {name: 'Attachments'}));
      await user.keyboard('[/MetaLeft]');
      await waitFor(() => expect(errorSpy).toHaveBeenCalled());
      expect(
        errorSpy.mock.calls
          .flat()
          .every(message =>
            String(message).includes('Not implemented: navigation to another Document')
          )
      ).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }

    expect(router.location.pathname).toBe('/tabs/details/');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});

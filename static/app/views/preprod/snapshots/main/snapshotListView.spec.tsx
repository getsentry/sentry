import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {closeModal, openModal} from 'sentry/actionCreators/modal';
import {mockElementSize} from 'sentry/utils/fixtures/virtualization';
import type {
  SidebarItem,
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotListView} from './snapshotListView';
import {VIEWED_SNAPSHOTS_STORAGE_KEY, viewedKeyForPair} from './useViewedSnapshots';

const mockZoom = {
  containerRef: {current: null},
  resetZoom: jest.fn(),
  transform: {x: 0, y: 0, k: 1},
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
};

jest.mock('./imageDisplay/useD3Zoom', () => ({
  useD3Zoom: () => mockZoom,
  useSyncedD3Zoom: () => [mockZoom, mockZoom],
}));

jest.mock('sentry/utils/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({copy: jest.fn()}),
}));

function image(overrides: Partial<SnapshotImage> = {}): SnapshotImage {
  return {
    display_name: 'Login screen',
    height: 180,
    image_file_name: 'login.png',
    key: 'head-login',
    tags: null,
    width: 320,
    ...overrides,
  };
}

const erroredPair: SnapshotDiffPair = {
  base_image: image({
    display_name: 'Login screen base',
    image_file_name: 'login.base.png',
    key: 'base-login',
  }),
  diff: null,
  diff_image_key: null,
  head_image: image(),
};

function ExampleSnapshotListView({
  items,
  diffMode,
}: {
  items: SidebarItem[];
  diffMode?: 'split' | 'wipe' | 'onion';
}) {
  return (
    <SnapshotListView
      items={items}
      imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
      diffMode={diffMode}
    />
  );
}

const erroredItem: SidebarItem = {
  key: 'errored:screens',
  name: 'Screens',
  displayName: 'Screens',
  pairs: [erroredPair],
  type: 'errored',
};

describe('SnapshotListView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElementSize({width: 900, height: 600});
    // jsdom returns empty padding strings; parseFloat('') is NaN, which would
    // propagate into the virtualizer's height math. Force numeric padding.
    jest.spyOn(window, 'getComputedStyle').mockReturnValue({
      paddingLeft: '0px',
      paddingRight: '0px',
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);
    HTMLElement.prototype.scrollIntoView = jest.fn();
    localStorage.clear();
  });

  it('renders errored pairs as side-by-side cards with a failed badge', () => {
    render(<ExampleSnapshotListView items={[erroredItem]} />);

    expect(screen.getByText('Failed to compare')).toBeInTheDocument();
  });

  it('renders errored pairs side-by-side even when the diff mode is onion', () => {
    render(<ExampleSnapshotListView items={[erroredItem]} diffMode="onion" />);

    expect(screen.getByText('Failed to compare')).toBeInTheDocument();
    // Onion mode renders an opacity slider; side-by-side (split) does not.
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  function changedGroup(
    count: number,
    tags: Record<string, string> | null = null
  ): Extract<SidebarItem, {type: 'changed'}> {
    return {
      key: 'changed:Screens',
      name: 'Screens',
      displayName: 'Screens',
      type: 'changed',
      pairs: Array.from({length: count}, (_, i) => ({
        base_image: image({image_file_name: `s${i}.base.png`, group: 'Screens'}),
        head_image: image({
          display_name: `Screen ${i}`,
          image_file_name: `s${i}.png`,
          group: 'Screens',
          tags,
        }),
        diff: null,
        diff_image_key: null,
      })),
    };
  }

  it('renders every card in a large single group (per-card rows) plus one header', () => {
    render(<ExampleSnapshotListView items={[changedGroup(6)]} />);

    expect(screen.getAllByRole('heading', {name: 'Screens'})).toHaveLength(1);
    expect(screen.getByText('Screen 0')).toBeInTheDocument();
    expect(screen.getByText('Screen 5')).toBeInTheDocument();
  });

  it('frames the first row of a group as frame-top and the last card row as frame-bottom', () => {
    render(<ExampleSnapshotListView items={[changedGroup(2)]} />);

    expect(document.querySelectorAll('[data-frame-top]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-frame-bottom]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-last-in-group]')).toHaveLength(1);
  });

  it('renders no group header for ungrouped items', () => {
    render(
      <ExampleSnapshotListView
        items={[
          {
            key: 'added:solo',
            name: 'solo.png',
            displayName: 'solo.png',
            type: 'added',
            images: [image({group: undefined, image_file_name: 'solo.png'})],
          },
        ]}
      />
    );

    expect(screen.queryByRole('heading', {name: 'solo.png'})).not.toBeInTheDocument();
  });

  it('reports the visible item key to the sidebar even for ungrouped items', async () => {
    const onVisibleGroupChange = jest.fn();
    render(
      <SnapshotListView
        items={[
          {
            key: 'added:solo',
            name: 'solo.png',
            displayName: 'solo.png',
            type: 'added',
            images: [image({group: undefined, image_file_name: 'solo.png'})],
          },
        ]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        onVisibleGroupChange={onVisibleGroupChange}
      />
    );

    await waitFor(() => expect(onVisibleGroupChange).toHaveBeenCalled());
    expect(onVisibleGroupChange).toHaveBeenLastCalledWith('added:solo');
  });

  it('arrow-down selects the next card via onSelectSnapshot', () => {
    const onSelectSnapshot = jest.fn();
    render(
      <SnapshotListView
        items={[changedGroup(3)]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        selectedSnapshotKey="s0.png"
        onSelectSnapshot={onSelectSnapshot}
      />
    );

    fireEvent.keyDown(document.body, {key: 'ArrowDown'});
    expect(onSelectSnapshot).toHaveBeenCalledWith('s1.png');
  });

  it('leaves Enter and Space to a focused button instead of opening the snapshot', () => {
    const onOpenSnapshot = jest.fn();
    render(
      <SnapshotListView
        items={[changedGroup(1)]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        selectedSnapshotKey="s0.png"
        onOpenSnapshot={onOpenSnapshot}
      />
    );

    const button = screen.getAllByRole('button', {name: 'Zoom in'})[0]!;
    fireEvent.keyDown(button, {key: 'Enter'});
    fireEvent.keyDown(button, {key: ' '});

    expect(onOpenSnapshot).not.toHaveBeenCalled();
  });

  it('collapses a card when it is marked viewed and expands it when unmarked', async () => {
    render(<ExampleSnapshotListView items={[changedGroup(1)]} />);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Screen 0 viewed'}));

    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).toHaveFocus();
    expect(screen.queryByRole('button', {name: 'Zoom in'})).not.toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(VIEWED_SNAPSHOTS_STORAGE_KEY)!)
    ).toHaveProperty([viewedKeyForPair(changedGroup(1).pairs[0]!)]);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Screen 0 viewed'}));

    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).not.toBeChecked();
    expect(screen.getAllByRole('button', {name: 'Zoom in'}).length).toBeGreaterThan(0);
  });

  it('moves the rows below a card up as soon as it is marked viewed', async () => {
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      if (!this.hasAttribute('data-index')) {
        return 600;
      }
      return this.querySelector('[aria-label="Zoom in"]') ? 400 : 48;
    });
    render(<ExampleSnapshotListView items={[changedGroup(2)]} />);
    jest.mocked(window.getComputedStyle).mockRestore();

    const lastRow = document.querySelector<HTMLElement>('[data-index="2"]')!;
    expect(lastRow).toHaveStyle({transform: 'translateY(448px)'});

    await userEvent.click(screen.getByRole('checkbox', {name: 'Screen 0 viewed'}));

    expect(lastRow).toHaveStyle({transform: 'translateY(96px)'});
  });

  describe('viewed scroll anchoring', () => {
    const originalScrollTo = HTMLElement.prototype.scrollTo;

    beforeEach(() => {
      jest.spyOn(window, 'getComputedStyle').mockReturnValue({
        paddingLeft: '0px',
        paddingRight: '0px',
        paddingTop: '16px',
        paddingBottom: '16px',
        getPropertyValue: () => '',
      } as unknown as CSSStyleDeclaration);
      jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
      jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900);
      jest
        .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
        .mockImplementation(function (this: HTMLElement) {
          if (!this.hasAttribute('data-index')) {
            return 600;
          }
          if (this.querySelector('h3')) {
            return 44;
          }
          const height = this.querySelector('[aria-label="Zoom in"]') ? 400 : 80;
          return height + (this.hasAttribute('data-last-in-group') ? 16 : 0);
        });
      jest
        .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
        .mockImplementation(function (this: HTMLElement) {
          const spacer = this.querySelector<HTMLElement>('[data-index]')?.parentElement;
          return (parseFloat(spacer?.style.height ?? '0') || 0) + 32;
        });
      HTMLElement.prototype.scrollTo = function (
        options?: ScrollToOptions | number,
        y?: number
      ) {
        this.scrollTop = Math.max(
          0,
          Math.min(
            typeof options === 'number' ? (y ?? 0) : (options?.top ?? 0),
            this.scrollHeight - this.clientHeight
          )
        );
        // Browsers deliver scroll events after layout, never inside React's commit.
        queueMicrotask(() => {
          if (this.isConnected) {
            this.dispatchEvent(new Event('scroll'));
          }
        });
      };
    });

    afterEach(() => {
      HTMLElement.prototype.scrollTo = originalScrollTo;
    });

    function siblingGroup(name: string): SidebarItem {
      const group = changedGroup(3);
      return {
        ...group,
        key: `changed:${name}`,
        name,
        pairs: group.pairs.map(pair => ({
          ...pair,
          head_image: {
            ...pair.head_image,
            image_file_name: `${name}/${pair.head_image.image_file_name}`,
            display_name: `${name}/${pair.head_image.display_name}`,
          },
        })),
      };
    }

    function listElements() {
      const spacer = document.querySelector<HTMLElement>('[data-index]')!.parentElement!;
      return {spacer, scroller: spacer.parentElement!};
    }

    async function scrollList(scroller: HTMLElement, top: number) {
      await act(async () => {
        scroller.scrollTo({top});
        await new Promise(requestAnimationFrame);
      });
    }

    async function settleLayout() {
      await act(async () => {
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
    }

    it('updates measured off-screen cards and preserves the group header at the top', async () => {
      render(
        <ExampleSnapshotListView
          items={[
            siblingGroup('Before'),
            changedGroup(45, {theme: 'light'}),
            siblingGroup('After'),
          ]}
        />
      );
      const {scroller, spacer} = listElements();
      // Visit the whole group, then return to its header with most cards unmounted.
      for (let top = 0; top < 19000; top += 2000) {
        await scrollList(scroller, top);
      }
      await scrollList(scroller, 44 + 3 * 400 + 16);
      expect(
        screen.queryByRole('checkbox', {name: 'Screen 20 viewed'})
      ).not.toBeInTheDocument();

      const top = scroller.scrollTop;
      await userEvent.click(
        screen.getAllByRole('checkbox', {name: 'All in Screens viewed'})[0]!
      );
      await settleLayout();

      expect(scroller.scrollTop).toBe(top);
      // Off-screen collapsed estimates are 48px; mounted tagged headers measure 80px.
      expect(parseFloat(spacer.style.height)).toBeLessThan(
        3 * 44 + 51 * 80 + 3 * 16 + 6 * 400
      );

      await userEvent.click(
        screen.getAllByRole('checkbox', {name: 'All in Screens viewed'})[0]!
      );
      await settleLayout();
      expect(scroller.scrollTop).toBe(top);
      expect(parseFloat(spacer.style.height)).toBeGreaterThan(45 * 300);
    });

    it('keeps the same card visible through five group toggle cycles from the middle', async () => {
      const onVisibleGroupChange = jest.fn();
      render(
        <SnapshotListView
          items={[siblingGroup('Before'), changedGroup(45), siblingGroup('After')]}
          imageBaseUrl="/images/"
          onVisibleGroupChange={onVisibleGroupChange}
        />
      );
      const {scroller} = listElements();
      await scrollList(scroller, 6500);
      // Align a mounted card header just below the sticky header.
      const rowTop = () => {
        const card = screen
          .getByRole('checkbox', {name: 'Screen 15 viewed'})
          .closest<HTMLElement>('[data-index]')!;
        return Number(card.style.transform.match(/translateY\((.*)px\)/)![1]);
      };
      await scrollList(scroller, rowTop() + 16 - 44);

      for (let cycle = 0; cycle < 5; cycle++) {
        await userEvent.click(
          screen.getByRole('checkbox', {name: 'All in Screens viewed'})
        );
        await settleLayout();
        expect(screen.getByRole('checkbox', {name: 'Screen 15 viewed'})).toBeChecked();
        expect(
          screen.getByRole('checkbox', {name: 'All in Screens viewed'})
        ).toHaveFocus();
        expect(rowTop() + 16 - scroller.scrollTop).toBe(44);
        expect(onVisibleGroupChange).toHaveBeenLastCalledWith('changed:Screens');

        await userEvent.click(
          screen.getByRole('checkbox', {name: 'All in Screens viewed'})
        );
        await settleLayout();
        expect(
          screen.getByRole('checkbox', {name: 'Screen 15 viewed'})
        ).not.toBeChecked();
        expect(rowTop() + 16 - scroller.scrollTop).toBe(44);
      }
    });

    it('reveals the collapsed header when the viewport was inside its image', async () => {
      render(<ExampleSnapshotListView items={[changedGroup(45)]} />);
      const {scroller} = listElements();
      await scrollList(scroller, 200);

      await userEvent.click(screen.getByRole('checkbox', {name: 'Screen 0 viewed'}));
      await settleLayout();

      expect(scroller.scrollTop).toBe(16);
      expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).toBeChecked();
    });
  });

  it('marks and unmarks every card in a group from the group checkbox', async () => {
    render(<ExampleSnapshotListView items={[changedGroup(2)]} />);

    await userEvent.click(screen.getByRole('checkbox', {name: 'All in Screens viewed'}));
    expect(screen.queryAllByRole('checkbox', {checked: false})).toHaveLength(0);

    await userEvent.click(screen.getByRole('checkbox', {name: 'All in Screens viewed'}));
    expect(screen.queryAllByRole('checkbox', {checked: true})).toHaveLength(0);
  });

  it('restores stored marks and drops ones whose images changed', async () => {
    const group = changedGroup(2);
    localStorage.setItem(
      VIEWED_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify(
        Object.fromEntries(group.pairs.map(pair => [viewedKeyForPair(pair), Date.now()]))
      )
    );
    const [first, second] = group.pairs;
    render(
      <ExampleSnapshotListView
        items={[
          {
            ...group,
            pairs: [
              first!,
              {...second!, base_image: {...second!.base_image, key: 'new-base-hash'}},
            ],
          },
        ]}
      />
    );

    const groupCheckbox = screen.getByRole('checkbox', {name: 'All in Screens viewed'});
    expect(groupCheckbox).toBePartiallyChecked();
    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Screen 1 viewed'})).not.toBeChecked();

    await userEvent.click(groupCheckbox);

    expect(screen.getByRole('checkbox', {name: 'Screen 1 viewed'})).toBeChecked();
  });

  it('does not offer a viewed toggle for unchanged images', () => {
    render(
      <ExampleSnapshotListView
        items={[
          {
            key: 'unchanged:solo',
            name: 'solo.png',
            displayName: 'solo.png',
            type: 'unchanged',
            images: [image({group: undefined, image_file_name: 'solo.png'})],
          },
          {
            key: 'unchanged:Screens',
            name: 'Screens',
            displayName: 'Screens',
            type: 'unchanged',
            images: [image({group: 'Screens', image_file_name: 'grouped.png'})],
          },
        ]}
      />
    );

    expect(screen.getByRole('heading', {name: 'Screens'})).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('ignores shortcuts while a modal is open', () => {
    const onSelectSnapshot = jest.fn();
    render(
      <SnapshotListView
        items={[changedGroup(3)]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        selectedSnapshotKey="s0.png"
        onSelectSnapshot={onSelectSnapshot}
      />
    );

    openModal(() => null);
    fireEvent.keyDown(document.body, {key: 'ArrowDown'});
    closeModal();

    expect(onSelectSnapshot).not.toHaveBeenCalled();
  });
});

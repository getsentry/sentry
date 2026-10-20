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

  function changedGroup(count: number): Extract<SidebarItem, {type: 'changed'}> {
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
        }),
        diff: null,
        diff_image_key: null,
      })),
    };
  }

  function siblingGroup(
    name: string,
    count = 3
  ): Extract<SidebarItem, {type: 'changed'}> {
    const group = changedGroup(count);
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

  function storeViewed(pairs: SnapshotDiffPair[]) {
    localStorage.setItem(
      VIEWED_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify(
        Object.fromEntries(pairs.map(pair => [viewedKeyForPair(pair), Date.now()]))
      )
    );
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

  it('toggles the selected card with v only once focus is in the list', async () => {
    render(
      <SnapshotListView
        items={[changedGroup(2)]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        selectedSnapshotKey="s0.png"
        onSelectSnapshot={jest.fn()}
      />
    );

    await userEvent.keyboard('v');
    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).not.toBeChecked();

    await userEvent.keyboard('{ArrowDown}v');
    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).toBeChecked();
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
    render(<ExampleSnapshotListView items={[changedGroup(2)]} />);
    const zoomButtons = screen.getAllByRole('button', {name: 'Zoom in'}).length;

    await userEvent.click(screen.getByRole('checkbox', {name: 'Screen 0 viewed'}));

    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).toBeChecked();
    expect(screen.getAllByRole('button', {name: 'Zoom in'})).toHaveLength(
      zoomButtons / 2
    );

    await userEvent.click(screen.getByRole('checkbox', {name: 'Screen 0 viewed'}));

    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).not.toBeChecked();
    expect(screen.getAllByRole('button', {name: 'Zoom in'})).toHaveLength(zoomButtons);
  });

  it('skips fully viewed groups with the arrow keys', () => {
    const viewedGroup = siblingGroup('B');
    storeViewed(viewedGroup.pairs);
    const onSelectSnapshot = jest.fn();
    render(
      <SnapshotListView
        items={[siblingGroup('A'), viewedGroup, siblingGroup('C')]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        selectedSnapshotKey="B/s1.png"
        onSelectSnapshot={onSelectSnapshot}
      />
    );

    expect(screen.queryByText('B/Screen 1')).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, {key: 'ArrowDown'});
    expect(onSelectSnapshot).toHaveBeenLastCalledWith('C/s0.png');

    fireEvent.keyDown(document.body, {key: 'ArrowUp'});
    expect(onSelectSnapshot).toHaveBeenLastCalledWith('A/s2.png');
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
          const height = this.querySelector('h3')
            ? 44
            : this.querySelector('[aria-label="Zoom in"]')
              ? 400
              : 80;
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
        queueMicrotask(() => {
          if (this.isConnected) {
            this.dispatchEvent(new Event('scroll'));
          }
        });
      };
    });

    afterEach(() => {
      HTMLElement.prototype.scrollTo = originalScrollTo;
      jest.restoreAllMocks();
    });

    function rowTop(scroller: HTMLElement, element: HTMLElement) {
      const row = element.closest<HTMLElement>('[data-index]')!;
      const translateY = Number(row.style.transform.match(/translateY\((.*)px\)/)![1]);
      return translateY + 16 - scroller.scrollTop;
    }

    function inListHeader() {
      return screen
        .getAllByRole('heading', {name: 'Screens'})
        .find(heading => heading.closest('[data-index]'))!;
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

    it('drops collapsed heights of cards that come back when their group is unviewed', async () => {
      const screens = changedGroup(45);
      storeViewed(screens.pairs.slice(0, 44));
      render(<ExampleSnapshotListView items={[screens]} />);
      const spacer = document.querySelector<HTMLElement>('[data-index]')!.parentElement!;
      const scroller = spacer.parentElement!;
      for (let top = 0; top < 5000; top += 1000) {
        await scrollList(scroller, top);
      }
      await scrollList(scroller, 0);
      const groupCheckbox = screen.getByRole('checkbox', {name: 'All in Screens viewed'});

      await userEvent.click(groupCheckbox);
      await settleLayout();
      await userEvent.click(groupCheckbox);
      await settleLayout();

      expect(parseFloat(spacer.style.height)).toBeGreaterThan(44 + 45 * 300);
    });

    it('keeps collapsed groups above in place when a group below them is unviewed', async () => {
      const before = siblingGroup('Before');
      const screens = changedGroup(45);
      storeViewed([...before.pairs, ...screens.pairs]);
      render(
        <ExampleSnapshotListView items={[before, screens, siblingGroup('After')]} />
      );
      const scroller =
        document.querySelector<HTMLElement>('[data-index]')!.parentElement!
          .parentElement!;
      await scrollList(scroller, 20);
      const headerTop = rowTop(scroller, inListHeader());

      await userEvent.click(
        screen.getByRole('checkbox', {name: 'All in Screens viewed'})
      );
      await settleLayout();

      expect(rowTop(scroller, inListHeader())).toBe(headerTop);
      expect(rowTop(scroller, screen.getByLabelText('Screen 0 viewed'))).toBe(
        headerTop + 44
      );
    });

    it('keeps the group header in place through repeated toggles from the sticky header', async () => {
      render(
        <ExampleSnapshotListView
          items={[siblingGroup('Before'), changedGroup(45), siblingGroup('After')]}
        />
      );
      const scroller =
        document.querySelector<HTMLElement>('[data-index]')!.parentElement!
          .parentElement!;
      await scrollList(scroller, 6500);
      const groupCheckbox = screen.getByRole('checkbox', {name: 'All in Screens viewed'});

      for (let cycle = 0; cycle < 2; cycle++) {
        await userEvent.click(groupCheckbox);
        await settleLayout();
        expect(screen.queryByLabelText('Screen 15 viewed')).not.toBeInTheDocument();
        expect(groupCheckbox).toBeChecked();
        expect(groupCheckbox).toHaveFocus();
        expect(rowTop(scroller, inListHeader())).toBe(0);

        await userEvent.click(groupCheckbox);
        await settleLayout();
        expect(groupCheckbox).not.toBeChecked();
        expect(rowTop(scroller, inListHeader())).toBe(0);
        expect(rowTop(scroller, screen.getByLabelText('Screen 0 viewed'))).toBe(44);
      }
    });
  });

  it('restores stored marks, drops changed images, and toggles the whole group', async () => {
    const group = changedGroup(2);
    storeViewed(group.pairs);
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
    expect(groupCheckbox).toBeChecked();
    expect(
      screen.queryByRole('checkbox', {name: 'Screen 0 viewed'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Screen 1 viewed'})
    ).not.toBeInTheDocument();

    await userEvent.click(groupCheckbox);
    expect(screen.queryAllByRole('checkbox', {checked: true})).toHaveLength(0);
    expect(screen.getByRole('checkbox', {name: 'Screen 1 viewed'})).toBeInTheDocument();
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

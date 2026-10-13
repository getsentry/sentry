import {
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

    expect(screen.getAllByRole('button', {name: 'Zoom in'}).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Screen 0 viewed'}));

    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).toBeChecked();
    expect(screen.queryByRole('button', {name: 'Zoom in'})).not.toBeInTheDocument();
    expect(screen.getByText('Screen 0')).toBeInTheDocument();
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

  it('marks every card in a group from the group checkbox', async () => {
    render(<ExampleSnapshotListView items={[changedGroup(2)]} />);
    const groupCheckbox = screen.getByRole('checkbox', {
      name: 'All in Screens viewed',
    });

    await userEvent.click(groupCheckbox);

    expect(groupCheckbox).toBeChecked();
    for (const cardCheckbox of screen.getAllByRole('checkbox', {
      name: /^Screen \d+ viewed$/,
    })) {
      expect(cardCheckbox).toBeChecked();
    }
    expect(screen.queryByRole('button', {name: 'Zoom in'})).not.toBeInTheDocument();
    expect(screen.getByText('Screen 0')).toBeInTheDocument();
    expect(screen.getByText('Screen 1')).toBeInTheDocument();

    await userEvent.click(groupCheckbox);

    expect(groupCheckbox).not.toBeChecked();
    for (const cardCheckbox of screen.getAllByRole('checkbox', {
      name: /^Screen \d+ viewed$/,
    })) {
      expect(cardCheckbox).not.toBeChecked();
    }
  });

  it('shows a partial group and marks the rest when clicked', async () => {
    const group = changedGroup(2);
    localStorage.setItem(
      VIEWED_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify({[viewedKeyForPair(group.pairs[0]!)]: Date.now()})
    );
    render(<ExampleSnapshotListView items={[group]} />);
    const groupCheckbox = screen.getByRole('checkbox', {
      name: 'All in Screens viewed',
    });

    expect(groupCheckbox).toBePartiallyChecked();

    await userEvent.click(groupCheckbox);

    expect(groupCheckbox).toBeChecked();
    for (const cardCheckbox of screen.getAllByRole('checkbox', {
      name: /^Screen \d+ viewed$/,
    })) {
      expect(cardCheckbox).toBeChecked();
    }
  });

  it('shows a fully viewed group as partial once one of its images changes', () => {
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
              {...second!, head_image: {...second!.head_image, key: 'new-head-hash'}},
            ],
          },
        ]}
      />
    );

    expect(
      screen.getByRole('checkbox', {name: 'All in Screens viewed'})
    ).toBePartiallyChecked();
    const [firstCard, secondCard] = screen.getAllByRole('checkbox', {
      name: /^Screen \d+ viewed$/,
    });
    expect(firstCard).toBeChecked();
    expect(secondCard).not.toBeChecked();
  });

  it('does not select the card when toggling viewed', async () => {
    const onSelectSnapshot = jest.fn();
    render(
      <SnapshotListView
        items={[changedGroup(1)]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        onSelectSnapshot={onSelectSnapshot}
      />
    );

    await userEvent.click(screen.getByRole('checkbox', {name: 'Screen 0 viewed'}));

    expect(onSelectSnapshot).not.toHaveBeenCalled();
  });

  it('starts collapsed for stored pairs and expanded once the base image changes', () => {
    const group = changedGroup(1);
    localStorage.setItem(
      VIEWED_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify({[viewedKeyForPair(group.pairs[0]!)]: Date.now()})
    );

    const {unmount} = render(<ExampleSnapshotListView items={[group]} />);
    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).toBeChecked();
    unmount();

    const pair = group.pairs[0]!;
    render(
      <ExampleSnapshotListView
        items={[
          {
            ...group,
            pairs: [{...pair, base_image: {...pair.base_image, key: 'new-base-hash'}}],
          },
        ]}
      />
    );
    expect(screen.getByRole('checkbox', {name: 'Screen 0 viewed'})).not.toBeChecked();
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

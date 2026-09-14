import type {SidebarItem, SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

import {buildRowIndex, buildRows, rowFrameEdges} from './snapshotListView';

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

function image(overrides: Partial<SnapshotImage> = {}): SnapshotImage {
  return {
    display_name: 'S',
    height: 180,
    image_file_name: 'a.png',
    key: 'k',
    tags: null,
    width: 320,
    group: 'Screens',
    ...overrides,
  };
}

describe('buildRows', () => {
  it('emits a header row then one card row per card for a grouped item', () => {
    const item: SidebarItem = {
      key: 'changed:Screens',
      name: 'Screens',
      displayName: 'Screens',
      type: 'changed',
      pairs: [
        {
          base_image: image({image_file_name: 'a.base.png'}),
          head_image: image({image_file_name: 'a.png'}),
          diff: null,
          diff_image_key: null,
        },
        {
          base_image: image({image_file_name: 'b.base.png'}),
          head_image: image({image_file_name: 'b.png'}),
          diff: null,
          diff_image_key: null,
        },
      ],
    };
    const rows = buildRows([item], 900);
    expect(rows.map(r => r.kind)).toEqual(['header', 'card', 'card']);
    expect(rows[0]).toMatchObject({
      kind: 'header',
      groupName: 'Screens',
      itemKey: 'changed:Screens',
    });
    expect(rows[1]).toMatchObject({
      kind: 'card',
      isFirstInGroup: true,
      isLastInGroup: false,
      isUngrouped: false,
    });
    expect(rows[2]).toMatchObject({
      kind: 'card',
      isFirstInGroup: false,
      isLastInGroup: true,
    });
  });

  it('emits only card rows (no header) for an ungrouped item', () => {
    const item: SidebarItem = {
      key: 'added:solo',
      name: 'solo.png',
      displayName: 'solo.png',
      type: 'added',
      images: [image({group: undefined, image_file_name: 'solo.png'})],
    };
    const rows = buildRows([item], 900);
    expect(rows.map(r => r.kind)).toEqual(['card']);
    expect(rows[0]).toMatchObject({
      kind: 'card',
      isUngrouped: true,
      isFirstInGroup: true,
      isLastInGroup: true,
      groupName: null,
    });
  });

  it('gives a card row CARD_CHROME_HEIGHT + image box + last-row gap', () => {
    const item: SidebarItem = {
      key: 'unchanged:Screens',
      name: 'Screens',
      displayName: 'Screens',
      type: 'unchanged',
      images: [image({width: 320, height: 180})],
    };
    const rows = buildRows([item], 900);
    const cardRow = rows.find(r => r.kind === 'card')!;
    expect(cardRow.estimatedHeight).toBe(120 + 180 + 16);
  });

  it('adds the errored banner height to changed/errored card estimates', () => {
    const pair = {
      base_image: image({image_file_name: 'a.base.png'}),
      head_image: image({image_file_name: 'a.png'}),
      diff: null,
      diff_image_key: null,
    };
    const changed = buildRows(
      [
        {
          key: 'changed:Screens',
          name: 'Screens',
          displayName: 'Screens',
          type: 'changed',
          pairs: [pair],
        },
      ],
      900
    ).find(r => r.kind === 'card')!;
    const errored = buildRows(
      [
        {
          key: 'errored:Screens',
          name: 'Screens',
          displayName: 'Screens',
          type: 'errored',
          pairs: [pair],
        },
      ],
      900
    ).find(r => r.kind === 'card')!;
    expect(errored.estimatedHeight).toBe(changed.estimatedHeight + 56);
  });

  it('renders renamed pairs as image cards carrying the pair as copyData', () => {
    const pair = {
      base_image: image({image_file_name: 'old.png'}),
      head_image: image({image_file_name: 'new.png'}),
      diff: null,
      diff_image_key: null,
    };
    const rows = buildRows(
      [
        {
          key: 'renamed:Screens',
          name: 'Screens',
          displayName: 'Screens',
          type: 'renamed',
          pairs: [pair],
        },
      ],
      900
    );
    const cardRow = rows.find(r => r.kind === 'card')!;
    expect(cardRow.card.type).toBe('image-card');
    expect(cardRow.card).toMatchObject({
      image: {image_file_name: 'new.png'},
      copyData: pair,
    });
  });
});

describe('rowFrameEdges', () => {
  const [header, firstCard, lastCard] = buildRows(
    [
      {
        key: 'changed:Screens',
        name: 'Screens',
        displayName: 'Screens',
        type: 'changed',
        pairs: [
          {
            base_image: image({image_file_name: 'a.base.png'}),
            head_image: image({image_file_name: 'a.png'}),
            diff: null,
            diff_image_key: null,
          },
          {
            base_image: image({image_file_name: 'b.base.png'}),
            head_image: image({image_file_name: 'b.png'}),
            diff: null,
            diff_image_key: null,
          },
        ],
      },
    ],
    900
  );
  const [ungroupedCard] = buildRows(
    [
      {
        key: 'added:solo',
        name: 'solo.png',
        displayName: 'solo.png',
        type: 'added',
        images: [image({group: undefined, image_file_name: 'solo.png'})],
      },
    ],
    900
  );

  it('puts the group top border on the header, not the grouped first card', () => {
    expect(rowFrameEdges(header!)).toEqual({
      frameTop: true,
      frameBottom: false,
      separator: false,
    });
    expect(rowFrameEdges(firstCard!)).toMatchObject({frameTop: false, separator: true});
  });

  it('closes the frame on the last card and boxes an ungrouped card fully', () => {
    expect(rowFrameEdges(lastCard!)).toMatchObject({frameBottom: true, separator: false});
    expect(rowFrameEdges(ungroupedCard!)).toEqual({
      frameTop: true,
      frameBottom: true,
      separator: false,
    });
  });
});

describe('buildRowIndex', () => {
  it('maps keys to card ordinals and row indices', () => {
    const rows = buildRows(
      [
        {
          key: 'changed:Screens',
          name: 'Screens',
          displayName: 'Screens',
          type: 'changed',
          pairs: [
            {
              base_image: image({image_file_name: 'a.base.png'}),
              head_image: image({image_file_name: 'a.png'}),
              diff: null,
              diff_image_key: null,
            },
            {
              base_image: image({image_file_name: 'b.base.png'}),
              head_image: image({image_file_name: 'b.png'}),
              diff: null,
              diff_image_key: null,
            },
          ],
        },
      ],
      900
    );
    const idx = buildRowIndex(rows);
    expect(idx.order).toEqual(['a.png', 'b.png']);
    expect(idx.positionByKey.get('b.png')).toBe(1);
    expect(idx.rowIndexByKey.get('a.png')).toBe(1);
    expect(idx.rowIndexByKey.get('b.png')).toBe(2);
    expect(idx.firstRowByItemKey.get('changed:Screens')).toBe(0);
    expect(idx.lastRowByItemKey.get('changed:Screens')).toBe(2);
  });
});

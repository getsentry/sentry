import {renderHook} from 'sentry-test/reactTestingLibrary';

import {DiffFileType} from 'sentry/components/events/autofix/types';
import {usePRWidgetData} from 'sentry/views/seerExplorer/components/prWidget';
import type {Block} from 'sentry/views/seerExplorer/types';

describe('usePRWidgetData', () => {
  it('handles repo names that match Object prototype properties', () => {
    const blocks: Block[] = [
      {
        id: 'block-1',
        message: {
          content: null,
          role: 'assistant',
        },
        timestamp: '2026-01-01T00:00:00Z',
        merged_file_patches: [
          {
            diff: '',
            repo_name: 'constructor',
            patch: {
              added: 3,
              hunks: [],
              path: 'src/example.ts',
              removed: 1,
              source_file: 'src/example.ts',
              target_file: 'src/example.ts',
              type: DiffFileType.MODIFIED,
            },
          },
        ],
      },
    ];

    const {result} = renderHook(() =>
      usePRWidgetData({
        blocks,
        repoPRStates: {},
        onCreatePR: jest.fn(),
      })
    );

    expect(result.current.totalAdded).toBe(3);
    expect(result.current.totalRemoved).toBe(1);
    expect(result.current.menuItems).toHaveLength(1);
    expect(result.current.menuItems[0]).toMatchObject({
      key: 'constructor',
      title: 'constructor',
    });
  });
});

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {DiffFileType} from 'sentry/components/events/autofix/types';
import {usePRWidgetData} from 'sentry/views/seerExplorer/components/prWidget';
import type {Block, RepoPRState} from 'sentry/views/seerExplorer/types';

const REPO = 'org/repo';

const blocks: Block[] = [
  {
    id: 'block-1',
    message: {role: 'assistant', content: 'done'},
    timestamp: '2024-01-01T00:00:00Z',
    merged_file_patches: [
      {
        repo_name: REPO,
        diff: '',
        patch: {
          added: 1,
          removed: 0,
          hunks: [],
          path: 'file.py',
          source_file: 'file.py',
          target_file: 'file.py',
          type: DiffFileType.MODIFIED,
        },
      },
    ],
  },
];

function prState(pr_url: string): Record<string, RepoPRState> {
  return {
    [REPO]: {
      repo_name: REPO,
      pr_url,
      pr_number: 1,
      pr_id: 1,
      branch_name: 'fix',
      commit_sha: null,
      pr_creation_error: null,
      pr_creation_status: 'completed',
      title: 'Fix',
    },
  };
}

describe('usePRWidgetData', () => {
  beforeEach(() => {
    jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens an https PR URL', () => {
    const {result} = renderHook(() =>
      usePRWidgetData({
        blocks,
        repoPRStates: prState('https://github.com/org/repo/pull/1'),
        onCreatePR: jest.fn(),
      })
    );

    result.current.menuItems[0]!.handler?.();

    expect(window.open).toHaveBeenCalledWith(
      'https://github.com/org/repo/pull/1',
      '_blank'
    );
  });

  it('does not open a javascript: PR URL', () => {
    const {result} = renderHook(() =>
      usePRWidgetData({
        blocks,
        // eslint-disable-next-line no-script-url
        repoPRStates: prState('javascript:alert(document.domain)'),
        onCreatePR: jest.fn(),
      })
    );

    result.current.menuItems[0]!.handler?.();

    expect(window.open).not.toHaveBeenCalled();
  });
});

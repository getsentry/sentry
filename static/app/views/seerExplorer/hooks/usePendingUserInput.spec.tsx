import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {usePendingUserInput} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import type {
  PendingUserInput,
  RespondToUserInputOptions,
} from 'sentry/views/seerExplorer/types';

function makeFileApproval(id: string, patchCount: number): PendingUserInput {
  return {
    id,
    input_type: 'file_change_approval',
    data: {
      patches: Array.from({length: patchCount}, (_, i) => ({
        patch: {path: `file-${i}.py`},
        repo_name: 'repo',
      })),
    },
  };
}

describe('usePendingUserInput', () => {
  const respondToUserInput = jest.fn<
    void,
    [string, ({decisions: boolean[]} | {answers: string[]})?, RespondToUserInputOptions?]
  >();
  const defaultProps = {
    isAwaitingUserInput: true,
    respondToUserInput,
    scrollContainerRef: {current: null},
    userScrolledUpRef: {current: false},
  };

  beforeEach(() => {
    respondToUserInput.mockClear();
  });

  it('steps back to the last patch when the approval fails to send', () => {
    const {result} = renderHookWithProviders(usePendingUserInput, {
      initialProps: {...defaultProps, pendingInput: makeFileApproval('input-a', 1)},
    });

    act(() => {
      result.current.handleFileApprovalApprove();
    });
    expect(respondToUserInput).toHaveBeenCalledWith(
      'input-a',
      {decisions: [true]},
      expect.objectContaining({onError: expect.any(Function)})
    );
    expect(result.current.fileApprovalIndex).toBe(1);

    act(() => {
      respondToUserInput.mock.lastCall?.[2]?.onError?.();
    });
    expect(result.current.fileApprovalIndex).toBe(0);
  });

  it('ignores a failed approval once a different input is pending', () => {
    const {result, rerender} = renderHookWithProviders(usePendingUserInput, {
      initialProps: {...defaultProps, pendingInput: makeFileApproval('input-a', 1)},
    });

    act(() => {
      result.current.handleFileApprovalApprove();
    });
    const onFirstApprovalError = respondToUserInput.mock.lastCall?.[2]?.onError;

    // Switch to another conversation with its own approval, and move past its first patch.
    rerender({...defaultProps, pendingInput: makeFileApproval('input-b', 3)});
    expect(result.current.fileApprovalIndex).toBe(0);
    act(() => {
      result.current.handleFileApprovalApprove();
    });
    expect(result.current.fileApprovalIndex).toBe(1);

    // The first approval's failure arrives late and must not touch input-b's state.
    act(() => {
      onFirstApprovalError?.();
    });
    expect(result.current.fileApprovalIndex).toBe(1);
  });
});

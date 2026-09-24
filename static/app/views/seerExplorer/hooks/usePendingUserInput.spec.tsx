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
  function renderPendingUserInput(pendingInput: PendingUserInput) {
    let lastOptions: RespondToUserInputOptions | undefined;
    const respondToUserInput = jest.fn(
      (_inputId: string, _data?: unknown, options?: RespondToUserInputOptions) => {
        lastOptions = options;
      }
    );
    const hook = renderHookWithProviders(
      (props: {pendingInput: PendingUserInput}) =>
        usePendingUserInput({
          isAwaitingUserInput: true,
          pendingInput: props.pendingInput,
          respondToUserInput,
          scrollContainerRef: {current: null},
          userScrolledUpRef: {current: false},
        }),
      {initialProps: {pendingInput}}
    );
    return {...hook, respondToUserInput, getLastOptions: () => lastOptions};
  }

  it('steps back to the last patch when the approval fails to send', () => {
    const {result, respondToUserInput, getLastOptions} = renderPendingUserInput(
      makeFileApproval('input-a', 1)
    );

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
      getLastOptions()?.onError?.();
    });
    expect(result.current.fileApprovalIndex).toBe(0);
  });

  it('ignores a failed approval once a different input is pending', () => {
    const {result, rerender, getLastOptions} = renderPendingUserInput(
      makeFileApproval('input-a', 1)
    );

    act(() => {
      result.current.handleFileApprovalApprove();
    });

    // Switch to another conversation with its own approval, and move past its first patch.
    rerender({pendingInput: makeFileApproval('input-b', 3)});
    expect(result.current.fileApprovalIndex).toBe(0);
    act(() => {
      result.current.handleFileApprovalApprove();
    });
    expect(result.current.fileApprovalIndex).toBe(1);

    // The first approval's failure arrives late and must not touch input-b's state.
    act(() => {
      getLastOptions()?.onError?.();
    });
    expect(result.current.fileApprovalIndex).toBe(1);
  });
});

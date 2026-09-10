import {renderHook} from 'sentry-test/reactTestingLibrary';

import {
  useAnnounceAutofixResult,
  useAutofixResultCount,
} from 'sentry/components/events/autofix/autofixResultStore';

interface Props {
  groupId: string;
  isComplete: boolean;
  step: string;
}

/**
 * Announces from one issue and reads the count for another, so the reader's
 * count is never the announcer's own render.
 */
function useAnnounceAndCount(props: Props, watchedGroupId: string) {
  useAnnounceAutofixResult(props.groupId, props.step, props.isComplete);
  return useAutofixResultCount(watchedGroupId);
}

// Announcements are deduped per issue and step for the life of the page, so
// each test uses its own issue id rather than resetting module state.
describe('autofixResultStore', () => {
  it('does not count a step that is still processing', () => {
    const {result} = renderHook(
      (props: Props) => useAnnounceAndCount(props, 'processing'),
      {initialProps: {groupId: 'processing', step: 'root_cause', isComplete: false}}
    );

    expect(result.current).toBe(0);
  });

  it('counts a step once it completes', () => {
    const {result, rerender} = renderHook(
      (props: Props) => useAnnounceAndCount(props, 'completes'),
      {initialProps: {groupId: 'completes', step: 'root_cause', isComplete: false}}
    );

    expect(result.current).toBe(0);

    rerender({groupId: 'completes', step: 'root_cause', isComplete: true});

    expect(result.current).toBe(1);
  });

  it('counts a completed step once across remounts', () => {
    const initialProps = {groupId: 'remount', step: 'root_cause', isComplete: true};

    const first = renderHook((props: Props) => useAnnounceAndCount(props, 'remount'), {
      initialProps,
    });
    expect(first.result.current).toBe(1);
    first.unmount();

    // Streaming remounts an embed that is already showing a finished step.
    const second = renderHook((props: Props) => useAnnounceAndCount(props, 'remount'), {
      initialProps,
    });

    expect(second.result.current).toBe(1);
  });

  it('counts each step of a run separately', () => {
    const {result, rerender} = renderHook(
      (props: Props) => useAnnounceAndCount(props, 'steps'),
      {initialProps: {groupId: 'steps', step: 'root_cause', isComplete: true}}
    );

    expect(result.current).toBe(1);

    rerender({groupId: 'steps', step: 'solution', isComplete: true});

    expect(result.current).toBe(2);
  });

  it('keeps one issue out of another issue count', () => {
    const {result} = renderHook((props: Props) => useAnnounceAndCount(props, 'watched'), {
      initialProps: {groupId: 'unwatched', step: 'root_cause', isComplete: true},
    });

    expect(result.current).toBe(0);
  });
});

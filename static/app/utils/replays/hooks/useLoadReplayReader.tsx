import {useMemo} from 'react';

import type {Group} from 'sentry/types/group';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  orgSlug: string;
  replaySlug: string;
  clipWindow?: {
    endTimestampMs: number;
    startTimestampMs: number;
  };
  group?: Group;
};

interface ReplayReaderResult extends ReturnType<typeof useReplayData> {
  replay: ReplayReader | null;
  replayId: string;
}

export default function useLoadReplayReader({
  orgSlug,
  replaySlug,
  clipWindow,
  group,
}: Props): ReplayReaderResult {
  const replayId = parseReplayId(replaySlug);

  const {attachments, errors, replayRecord, fetching, ...replayData} = useReplayData({
    orgSlug,
    replayId,
  });

  // get first error matching our group
  const firstMatchingError = useMemo(
    () => group && errors.find(error => error['issue.id'].toString() === group.id),
    [errors, group]
  );

  // if we don't have a clip window, we'll use the error time to create a clip window
  const memoizedClipWindow = useMemo(() => {
    const errorTime = firstMatchingError
      ? new Date(firstMatchingError.timestamp)
      : undefined;

    return (
      clipWindow ??
      (errorTime && {
        startTimestampMs: errorTime.getTime() - 1000 * 5,
        endTimestampMs: errorTime.getTime() + 1000 * 5,
      })
    );
  }, [clipWindow, firstMatchingError]);

  const featureFlags = useOrganization().features;

  const replay = useMemo(
    () =>
      ReplayReader.factory({
        attachments,
        clipWindow: memoizedClipWindow,
        errors,
        featureFlags,
        fetching,
        replayRecord,
      }),
    [attachments, memoizedClipWindow, errors, featureFlags, fetching, replayRecord]
  );

  return {
    ...replayData,
    attachments,
    errors,
    fetching,
    replay,
    replayId,
    replayRecord,
  };
}

// see https://github.com/getsentry/sentry/pull/47859
// replays can apply to many projects when incorporating backend errors
// this makes having project in the `replaySlug` obsolete
// we must keep this url schema for now for backward compat but we should remove it at some point
// TODO: remove support for projectSlug in replay url?
function parseReplayId(replaySlug: string) {
  const maybeProjectSlugAndReplayId = replaySlug.split(':');
  if (maybeProjectSlugAndReplayId.length === 2) {
    return maybeProjectSlugAndReplayId[1];
  }

  // if there is no projectSlug then we assume we just have the replayId
  // all other cases would be a malformed url
  return maybeProjectSlugAndReplayId[0];
}

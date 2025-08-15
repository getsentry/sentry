import {
  ReplayActivityColumn,
  ReplayBrowserColumn,
  ReplayCountDeadClicksColumn,
  ReplayCountErrorsColumn,
  ReplayCountRageClicksColumn,
  ReplayDurationColumn,
  ReplayOSColumn,
  ReplaySelectColumn,
  ReplaySessionColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import type {useDimensions} from 'sentry/utils/useDimensions';

const MOBILE = [
  ReplaySelectColumn,
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayDurationColumn,
  ReplayCountErrorsColumn,
  ReplayActivityColumn,
] as const;

const WEB_MAX_1000 = [
  ReplaySelectColumn,
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayBrowserColumn,
  ReplayDurationColumn,
  ReplayCountErrorsColumn,
  ReplayActivityColumn,
] as const;

const WEB_MAX_800 = [
  ReplaySelectColumn,
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayBrowserColumn,
  ReplayDurationColumn,
  ReplayCountErrorsColumn,
] as const;

const WEB_ALL = [
  ReplaySelectColumn,
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayBrowserColumn,
  ReplayDurationColumn,
  ReplayCountDeadClicksColumn,
  ReplayCountRageClicksColumn,
  ReplayCountErrorsColumn,
  ReplayActivityColumn,
] as const;

export default function useReplayIndexTableColumns({
  allMobileProj,
  tableDimensions,
}: {
  allMobileProj: boolean;
  tableDimensions: ReturnType<typeof useDimensions>;
}) {
  if (allMobileProj) {
    return MOBILE;
  }
  if (tableDimensions.width < 800) {
    return WEB_MAX_800;
  }
  if (tableDimensions.width < 1000) {
    return WEB_MAX_1000;
  }
  return WEB_ALL;
}

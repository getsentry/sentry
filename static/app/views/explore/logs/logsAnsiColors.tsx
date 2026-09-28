import {createContext, useContext, useMemo, useState} from 'react';

import type {QueryValue} from 'sentry/utils/queryString';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

export const LOGS_COLOR_OPACITY_KEY = 'logsColorOpacity';
export const LOGS_COLOR_TOGGLE_KEY = 'logsPageToggle';

export const ANSI_ESCAPE_CHARACTER = '\u001B';

interface LogsAnsiColors {
  hasColoredLogs: boolean;
  isColorEnabled: boolean;
  /**
   * The page-level opt-in switch prototype is active, so the switch decides
   * whether color renders rather than the opacity param alone.
   */
  isToggleAvailable: boolean;
  /**
   * How strongly the terminal color replaces the usual body text color, 0 to 1.
   */
  opacity: number;
  setColorEnabled: (enabled: boolean) => void;
}

const DEFAULT_ANSI_COLORS: LogsAnsiColors = {
  hasColoredLogs: false,
  isColorEnabled: false,
  isToggleAvailable: false,
  opacity: 0,
  setColorEnabled: () => {},
};

const LogsAnsiColorsContext = createContext<LogsAnsiColors>(DEFAULT_ANSI_COLORS);

export function useLogsAnsiColors(): LogsAnsiColors {
  return useContext(LogsAnsiColorsContext);
}

export function LogsPageAnsiColorsProvider({children}: {children: React.ReactNode}) {
  const {infiniteLogsQueryResult} = useLogsPageData();

  return (
    <LogsAnsiColorsProvider rows={infiniteLogsQueryResult.data}>
      {children}
    </LogsAnsiColorsProvider>
  );
}

export function LogsAnsiColorsProvider({
  children,
  rows,
}: {
  children: React.ReactNode;
  rows: readonly OurLogsResponseItem[];
}) {
  const location = useLocation();
  const [isSwitchOn, setColorEnabled] = useState(false);

  const opacityParam = decodeOpacity(location.query[LOGS_COLOR_OPACITY_KEY]);
  const isToggleAvailable = decodeFlag(location.query[LOGS_COLOR_TOGGLE_KEY]);

  const hasColoredLogs = useMemo(() => rows.some(hasAnsiEscapeCodes), [rows]);

  const value = useMemo(
    (): LogsAnsiColors => ({
      hasColoredLogs,
      // An opt-in switch with no opacity set would be a dead control, so it renders at full strength.
      opacity: (isToggleAvailable && opacityParam === 0 ? 100 : opacityParam) / 100,
      isColorEnabled: isToggleAvailable ? isSwitchOn : opacityParam > 0,
      isToggleAvailable,
      setColorEnabled,
    }),
    [hasColoredLogs, isSwitchOn, isToggleAvailable, opacityParam]
  );

  return <LogsAnsiColorsContext value={value}>{children}</LogsAnsiColorsContext>;
}

function hasAnsiEscapeCodes(row: OurLogsResponseItem): boolean {
  return [row[OurLogKnownFieldKey.MESSAGE], row[OurLogKnownFieldKey.TEMPLATE]].some(
    value => typeof value === 'string' && value.includes(ANSI_ESCAPE_CHARACTER)
  );
}

function decodeOpacity(value: QueryValue): number {
  const parsed = parseInt(decodeScalar(value) ?? '', 10);
  if (!isFinite(parsed)) {
    return 0;
  }
  return Math.min(100, Math.max(0, parsed));
}

function decodeFlag(value: QueryValue): boolean {
  const unwrapped = decodeScalar(value);
  return unwrapped === 'true' || unwrapped === '1';
}

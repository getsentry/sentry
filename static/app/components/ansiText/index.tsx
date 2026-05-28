import type {ReactElement} from 'react';
import {useMemo} from 'react';

import {AnsiToReact} from 'sentry/components/ansiText/ansiToReact';
import {normalizeTerminalText} from 'sentry/components/ansiText/normalizeTerminalText';

type AnsiTextProps = {
  text: string;
  normalizeTerminalSequences?: boolean;
};

export function AnsiText({
  text,
  normalizeTerminalSequences = false,
}: AnsiTextProps): ReactElement {
  const displayText = useMemo(
    () => (normalizeTerminalSequences ? normalizeTerminalText(text) : text),
    [normalizeTerminalSequences, text]
  );

  return <AnsiToReact text={displayText} />;
}

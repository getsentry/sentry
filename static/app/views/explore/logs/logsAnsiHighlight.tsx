import {AnsiText} from 'sentry/components/ansiText';
import {LogsHighlight} from 'sentry/views/explore/logs/styles';

interface LogsAnsiHighlightProps {
  children: string;
  caseSensitive?: boolean;
  terms?: string[];
}

export function LogsAnsiHighlight({
  caseSensitive,
  children,
  terms = [],
}: LogsAnsiHighlightProps) {
  return (
    <AnsiText
      renderText={text => (
        <LogsHighlight caseSensitive={caseSensitive} terms={terms}>
          {text}
        </LogsHighlight>
      )}
    >
      {children}
    </AnsiText>
  );
}

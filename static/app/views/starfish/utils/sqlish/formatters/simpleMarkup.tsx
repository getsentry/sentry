import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export function simpleMarkup(tokens: Token[]): React.ReactElement[] {
  const accumulator: React.ReactElement[] = [];

  function contentize(content: Token): void {
    if (Array.isArray(content.content)) {
      content.content.forEach(contentize);
      return;
    }

    if (typeof content.content === 'string') {
      if (content.type === 'Keyword') {
        accumulator.push(<b key={toKey(content.content)}>{content.content}</b>);
      } else {
        accumulator.push(<span key={toKey(content.content)}>{content.content}</span>);
      }
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator;
}

function toKey(content: string): string {
  return content.toLowerCase();
}

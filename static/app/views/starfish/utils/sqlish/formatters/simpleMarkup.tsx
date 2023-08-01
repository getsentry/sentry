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
        accumulator.push(<b>{content.content.toUpperCase()}</b>);
      } else if (content.type === 'Whitespace') {
        accumulator.push(<span> </span>);
      } else {
        accumulator.push(<span>{content.content}</span>);
      }
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator;
}

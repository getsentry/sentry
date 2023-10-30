import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export function simpleMarkup(tokens: Token[]): React.ReactElement[] {
  const accumulator: React.ReactElement[] = [];

  function contentize(token: Token): void {
    if (Array.isArray(token.content)) {
      token.content.forEach(contentize);
      return;
    }

    if (typeof token.content === 'string') {
      if (token.type === 'Keyword') {
        accumulator.push(<b>{token.content.toUpperCase()}</b>);
      } else if (token.type === 'Whitespace') {
        accumulator.push(<span> </span>);
      } else {
        accumulator.push(<span>{token.content}</span>);
      }
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator;
}

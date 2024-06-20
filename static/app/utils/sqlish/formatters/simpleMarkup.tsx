import type {Token} from 'sentry/utils/sqlish/types';

export function simpleMarkup(tokens: Token[]): React.ReactElement[] {
  const accumulator: React.ReactElement[] = [];

  function contentize(token: Token, index: number): void {
    if (Array.isArray(token.content)) {
      token.content.forEach(contentize);
      return;
    }

    if (typeof token.content === 'string') {
      if (token.type === 'Keyword') {
        accumulator.push(<b key={index}>{token.content.toUpperCase()}</b>);
      } else if (token.type === 'Whitespace') {
        accumulator.push(<span key={index}> </span>);
      } else {
        accumulator.push(<span key={index}>{token.content}</span>);
      }
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator;
}

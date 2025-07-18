import {ELLIPSIS} from 'sentry/utils/string/unicode';

export interface TrimTextCenter {
  end: number;
  length: number;
  start: number;
  text: string;
}

export function trimTextCenter(text: string, low: number): TrimTextCenter {
  if (low >= text.length) {
    return {
      text,
      start: 0,
      end: 0,
      length: 0,
    };
  }

  const prefixLength = Math.floor(low / 2);
  // Use 1 character less than the low value to account for ellipsis and favor displaying the prefix
  const postfixLength = low - prefixLength - 1;

  const start = prefixLength;
  const end = Math.floor(text.length - postfixLength + ELLIPSIS.length);
  const trimText = `${text.substring(0, start)}${ELLIPSIS}${text.substring(end)}`;

  return {
    text: trimText,
    start,
    end,
    length: end - start,
  };
}

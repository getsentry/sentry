import {useCallback} from 'react';

import {useFormattingSnapshot} from '../dateTime/context';

import {formatRelativeDate, type getRelativeDate} from './getRelativeDate';

export function useRelativeTimeFormatter(): typeof getRelativeDate {
  const snapshot = useFormattingSnapshot();
  return useCallback(
    (date, options = {}) => formatRelativeDate(date, options, snapshot),
    [snapshot]
  );
}

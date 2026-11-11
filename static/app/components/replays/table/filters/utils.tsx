import {useCallback} from 'react';
import styled from '@emotion/styled';
import {parseAsString, useQueryState} from 'nuqs';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function useGenerateAction() {
  const [, setQuery] = useQueryState('query', parseAsString.withDefault(''));

  return useCallback(
    ({key, value}: {key: string; value: string}) =>
      () => {
        setQuery(
          query => new MutableSearch(query).setFilterValues(key, [value]).formatString(),
          {history: 'push'}
        );
      },
    [setQuery]
  );
}

export const ActionMenuTrigger = styled(OverlayTrigger.IconButton)`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.1s;

  &:focus-visible,
  &[aria-expanded='true'] {
    opacity: 1;
  }
`;

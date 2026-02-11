import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from '@sentry/scraps/button';

import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {useNavigate} from 'sentry/utils/useNavigate';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

export function generateAction({
  key,
  value,
  location,
  navigate,
}: {
  key: string;
  location: Location<ReplayListLocationQuery>;
  navigate: ReturnType<typeof useNavigate>;
  value: string;
}) {
  const search = new MutableSearch(decodeScalar(location.query.query) || '');

  const onAction = () => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        query: search.setFilterValues(key, [value]).formatString(),
      },
    });
  };

  return onAction;
}

export const ActionMenuTrigger = styled(Button)`
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

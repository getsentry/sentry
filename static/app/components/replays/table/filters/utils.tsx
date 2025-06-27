import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/core/button';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {useNavigate} from 'sentry/utils/useNavigate';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type EditType = 'set' | 'remove';

export function generateAction({
  key,
  value,
  edit,
  location,
  navigate,
}: {
  edit: EditType;
  key: string;
  location: Location<ReplayListLocationQuery>;
  navigate: ReturnType<typeof useNavigate>;
  value: string;
}) {
  const search = new MutableSearch(decodeScalar(location.query.query) || '');

  const modifiedQuery =
    edit === 'set' ? search.setFilterValues(key, [value]) : search.removeFilter(key);

  const onAction = () => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        query: modifiedQuery.formatString(),
      },
    });
  };

  return onAction;
}

export const ActionMenuTrigger = styled(Button)`
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  padding: ${space(0.75)};
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.1s;

  &:focus-visible,
  &[aria-expanded='true'] {
    opacity: 1;
  }
`;

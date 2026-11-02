import styled from '@emotion/styled';
import type {Location} from 'history';
import {parseAsString} from 'nuqs';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {useNavigate} from 'sentry/utils/useNavigate';
import {
  applyQueryParamsUpdates,
  loadQueryParamsFromLocation,
} from 'sentry/views/explore/queryParams/parsers';

const replayFilterParsers = {query: parseAsString.withDefault('')};

export function generateAction({
  key,
  value,
  location,
  navigate,
}: {
  key: string;
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
  value: string;
}) {
  const {query} = loadQueryParamsFromLocation(replayFilterParsers, location);
  const search = new MutableSearch(query);

  const onAction = () => {
    navigate({
      pathname: location.pathname,
      query: applyQueryParamsUpdates(replayFilterParsers, location, {
        query: search.setFilterValues(key, [value]).formatString(),
      }).query,
    });
  };

  return onAction;
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

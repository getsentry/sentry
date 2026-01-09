import styled from '@emotion/styled';

import usePrevious from 'sentry/utils/usePrevious';

export function usePreviouslyLoaded<T>(current: T, isLoading: boolean): T {
  const previous = usePrevious(current, isLoading);
  return isLoading ? previous : current;
}

export const Container = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
`;

import styled from '@emotion/styled';

import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';

import {X_GUTTER, Y_GUTTER} from '../common/settings';

export function LoadingPanel() {
  return (
    <LoadingPlaceholder>
      <LoadingMask visible />
      <LoadingIndicator mini />
    </LoadingPlaceholder>
  );
}
const LoadingPlaceholder = styled('div')`
  position: absolute;
  inset: 0;

  display: flex;
  justify-content: center;
  align-items: center;

  padding: ${Y_GUTTER} ${X_GUTTER};
`;

const LoadingMask = styled(TransparentLoadingMask)`
  background: ${p => p.theme.background};
`;

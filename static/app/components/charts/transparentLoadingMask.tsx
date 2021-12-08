import * as React from 'react';
import styled from '@emotion/styled';

import LoadingMask from 'sentry/components/loadingMask';

interface Props {
  visible: boolean;
  className?: string;
  children?: React.ReactNode;
}

const TransparentLoadingMask = styled(({className, visible, children}: Props) => {
  const other = visible ? {'data-test-id': 'loading-placeholder'} : {};
  return (
    <LoadingMask className={className} {...other}>
      {children}
    </LoadingMask>
  );
})<Props>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

export default TransparentLoadingMask;

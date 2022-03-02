import * as React from 'react';
import styled from '@emotion/styled';

import LoadingMask, {LoadingMaskProps} from 'sentry/components/loadingMask';

interface TransparentLoadingMaskProps extends LoadingMaskProps {
  visible: boolean;
  children?: React.ReactNode;
  className?: string;
}

const TransparentLoadingMask = styled(
  ({className, visible, children, ...props}: TransparentLoadingMaskProps) => {
    const other = visible ? {...props, 'data-test-id': 'loading-placeholder'} : props;
    return (
      <LoadingMask className={className} {...other}>
        {children}
      </LoadingMask>
    );
  }
)<TransparentLoadingMaskProps>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

export default TransparentLoadingMask;

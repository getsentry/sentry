import React from 'react';
import styled from '@emotion/styled';

import LoadingMask from 'app/components/loadingMask';

type Props = {
  visible: boolean;
  className?: string;
  children?: React.ReactNode;
} & React.HTMLProps<HTMLDivElement>;

const TransparentLoadingMask = styled(
  ({className, visible, children, ...props}: Props) => {
    const other = visible ? {...props, 'data-test-id': 'loading-placeholder'} : props;
    return (
      <LoadingMask className={className} {...other}>
        {children}
      </LoadingMask>
    );
  }
)<Props>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

export default TransparentLoadingMask;

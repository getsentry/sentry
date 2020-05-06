import styled from '@emotion/styled';

import LoadingMask from 'app/components/loadingMask';

type Props = {
  visible: boolean;
};

const TransparentLoadingMask = styled(LoadingMask)<Props>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

export default TransparentLoadingMask;

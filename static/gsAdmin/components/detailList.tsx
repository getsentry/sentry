import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  maxLabelSize?: number;
};

const DetailList = styled('dl')<Props>`
  display: grid;
  gap: ${space(1)};
  grid-template-columns:
    minmax(${p => (p.maxLabelSize ? `${p.maxLabelSize}px` : '110px')}, max-content)
    1fr;
  margin-bottom: 0;
`;

export default DetailList;

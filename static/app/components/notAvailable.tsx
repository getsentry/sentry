import * as React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {defined} from 'app/utils';

type Props = {
  tooltip?: React.ReactNode;
};

function NotAvailable({tooltip}: Props) {
  return (
    <Wrapper>
      <Tooltip title={tooltip} disabled={!defined(tooltip)}>
        {'\u2014'}
      </Tooltip>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  color: ${p => p.theme.gray200};
`;

export default NotAvailable;

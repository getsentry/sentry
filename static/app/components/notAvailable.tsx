import * as React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {defined} from 'sentry/utils';

type Props = {
  className?: string;
  tooltip?: React.ReactNode;
};

function NotAvailable({tooltip, className}: Props) {
  return (
    <Wrapper className={className}>
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

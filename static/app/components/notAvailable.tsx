import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';

type Props = {
  className?: string;
  tooltip?: React.ReactNode;
};

function NotAvailable({tooltip, className}: Props) {
  return (
    <Tooltip title={tooltip} skipWrapper disabled={tooltip === undefined}>
      <Wrapper className={className}>{'\u2014'}</Wrapper>
    </Tooltip>
  );
}

const Wrapper = styled('div')`
  color: ${p => p.theme.gray200};
`;

export default NotAvailable;

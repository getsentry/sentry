import styled from '@emotion/styled';

import {formatBytesBase2} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = {
  className?: string;
  bytes: number;
};

function FileSize(props: Props) {
  const {className, bytes} = props;

  return (
    <Span className={className}>
      {getDynamicText({value: formatBytesBase2(bytes), fixed: 'xx KB'})}
    </Span>
  );
}

const Span = styled('span')`
  font-variant-numeric: tabular-nums;
`;

export default FileSize;

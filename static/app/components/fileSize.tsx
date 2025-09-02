import styled from '@emotion/styled';

import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';

type Props = {
  bytes: number;
  base?: 2 | 10;
  className?: string;
};

function FileSize(props: Props) {
  const {className, bytes, base} = props;

  return (
    <Span className={className}>
      {base === 10 ? formatBytesBase10(bytes) : formatBytesBase2(bytes)}
    </Span>
  );
}

const Span = styled('span')`
  font-variant-numeric: tabular-nums;
`;

export default FileSize;

import styled from '@emotion/styled';

import {formatBytesBase2, formatBytesBase10} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = {
  bytes: number;
  base?: 2 | 10;
  className?: string;
};

function FileSize(props: Props) {
  const {className, bytes, base} = props;

  return (
    <Span className={className}>
      {getDynamicText({
        value: base === 10 ? formatBytesBase10(bytes) : formatBytesBase2(bytes),
        fixed: 'xx KB',
      })}
    </Span>
  );
}

const Span = styled('span')`
  font-variant-numeric: tabular-nums;
`;

export default FileSize;

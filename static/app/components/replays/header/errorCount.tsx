import styled from '@emotion/styled';

import {IconFire} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type Props = {
  countErrors: number;
  className?: string;
};

const ErrorCount = styled(({countErrors, className}: Props) =>
  countErrors ? (
    <span className={className}>
      <IconFire />
      {countErrors}
    </span>
  ) : (
    <span className={className}>0</span>
  )
)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => (p.countErrors > 0 ? p.theme.red400 : 'inherit')};
  font-variant-numeric: tabular-nums;
`;

export default ErrorCount;

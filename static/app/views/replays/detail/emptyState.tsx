import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

export default StyledEmptyStateWarning;

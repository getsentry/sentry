import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function TokensPage() {
  return (
    <LayoutGap>
      <p>Tokens</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

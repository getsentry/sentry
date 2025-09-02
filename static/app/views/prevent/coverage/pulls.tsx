import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function PullsListPage() {
  return (
    <LayoutGap>
      <p>Pulls List</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

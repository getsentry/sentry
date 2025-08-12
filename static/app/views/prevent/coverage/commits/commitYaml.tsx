import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function CommitYamlPage() {
  return (
    <LayoutGap>
      <p>Commit YAML Page</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

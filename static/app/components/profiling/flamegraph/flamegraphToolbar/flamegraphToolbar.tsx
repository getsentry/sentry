import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {space} from 'sentry/styles/space';

interface FlamegraphToolbarProps {
  children: React.ReactNode;
}

const FlamegraphToolbarWrapper = styled('div')`
  margin: ${space(1)};
`;

export function FlamegraphToolbar({children}: FlamegraphToolbarProps) {
  return (
    <FlamegraphToolbarWrapper>
      <Flex justify="between" align="center" gap="sm">
        {children}
      </Flex>
    </FlamegraphToolbarWrapper>
  );
}

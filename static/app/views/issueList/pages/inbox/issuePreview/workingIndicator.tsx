import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';

export function WorkingIndicator({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" gap="sm">
      <WorkingSpinner size={16} />
      <Text variant="muted">{children}</Text>
    </Flex>
  );
}

const WorkingSpinner = styled(LoadingIndicator)`
  margin: 0;
`;

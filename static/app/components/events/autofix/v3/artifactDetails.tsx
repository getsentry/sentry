import {type ReactNode} from 'react';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

interface ArtifactDetailsProps extends FlexProps {
  children: ReactNode;
}

export function ArtifactDetails({children, ...flexProps}: ArtifactDetailsProps) {
  return (
    <Flex direction="column" borderTop="primary" gap="md" paddingTop="lg" {...flexProps}>
      {children}
    </Flex>
  );
}

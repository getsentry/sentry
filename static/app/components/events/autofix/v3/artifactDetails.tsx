import {type ReactNode} from 'react';

import {Stack, type FlexProps} from '@sentry/scraps/layout';

interface ArtifactDetailsProps extends FlexProps {
  children: ReactNode;
}

export function ArtifactDetails({children, ...flexProps}: ArtifactDetailsProps) {
  return (
    <Stack borderTop="primary" gap="md" paddingTop="lg" {...flexProps}>
      {children}
    </Stack>
  );
}

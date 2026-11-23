import type {ReactNode} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

/**
 * Lets callers outside an automation form discard its unsaved changes
 */
export type AutomationFormHandle = {reset: () => void};

export function FormSection({title, children}: {children: ReactNode; title: string}) {
  return (
    <Stack gap="md">
      <Container paddingLeft="md">
        <Heading as="h2" size="lg">
          {title}
        </Heading>
      </Container>
      {children}
    </Stack>
  );
}

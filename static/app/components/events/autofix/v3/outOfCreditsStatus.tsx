import type {ReactNode} from 'react';

import {Text} from '@sentry/scraps/text';

import {ArtifactDetails} from './artifactDetails';

interface OutOfCreditsStatusProps {
  message: string;
  /**
   * The step's retry, disabled while the organization can't afford it, or the
   * re-run prompt it opened.
   */
  children?: ReactNode;
}

/**
 * Says a step stopped because the organization ran out of Seer credits. The
 * credit gates show the CTA to add credits, so this only says what happened.
 */
export function OutOfCreditsStatus({children, message}: OutOfCreditsStatusProps) {
  return (
    <ArtifactDetails gap="lg">
      <Text variant="muted">{message}</Text>
      {children}
    </ArtifactDetails>
  );
}

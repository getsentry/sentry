import type {ReactNode} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';

interface ScmPickerSectionProps {
  children: ReactNode;
  /** A control below the body, such as a link to swap between pickers. */
  action?: ReactNode;
  /** A short label or helper above the body, with or without an icon. */
  title?: ReactNode;
}

/**
 * The label-body-action stack every picker in the SCM flow shares: the
 * connected repo, the detected platforms, and the manual platform search. One
 * shell keeps the three reading as the same thing, and lets a body swap
 * without the label moving.
 */
export function ScmPickerSection({title, action, children}: ScmPickerSectionProps) {
  return (
    <Stack width="100%" gap="md" align="start">
      {title ? (
        <Flex align="center" gap="sm" minWidth={0} width="100%">
          {title}
        </Flex>
      ) : null}
      {children}
      {action}
    </Stack>
  );
}

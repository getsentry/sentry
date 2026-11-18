import type {ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

interface BenefitProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Benefit({children, size = 'md'}: BenefitProps) {
  return (
    <Flex as="li" align="center" gap="sm">
      <IconCheckmark size="sm" variant="success" />
      <Text size={size}>{children}</Text>
    </Flex>
  );
}

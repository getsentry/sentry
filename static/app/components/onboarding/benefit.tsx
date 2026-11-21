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
    <Flex as="li" align="center" gap={size === 'lg' ? 'md' : 'sm'}>
      <IconCheckmark size={size === 'lg' ? 'md' : 'sm'} variant="success" />
      <Text
        size={size}
        density={size === 'lg' ? 'default' : undefined}
        trim={size === 'lg' ? false : undefined}
      >
        {children}
      </Text>
    </Flex>
  );
}

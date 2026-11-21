import type {ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Flex} from '@sentry/scraps/layout';
import {Text, type TextProps} from '@sentry/scraps/text';

interface BenefitProps {
  children: ReactNode;
  density?: TextProps<'span'>['density'];
  size?: 'sm' | 'md' | 'lg';
}

export function Benefit({children, density, size = 'md'}: BenefitProps) {
  return (
    <Flex as="li" align="center" gap="sm">
      <IconCheckmark size="sm" variant="success" />
      <Text size={size} density={density}>
        {children}
      </Text>
    </Flex>
  );
}

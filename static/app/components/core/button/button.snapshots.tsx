import {Button, type ButtonProps} from '@sentry/scraps/button';

import {IconEdit} from 'sentry/icons';

import type {ButtonSize} from './types';

const allVariants: Array<ButtonProps['variant']> = [
  'secondary',
  'primary',
  'danger',
  'warning',
  'link',
  'transparent',
];

const allSizes: ButtonSize[] = ['zero', 'xs', 'sm', 'md'];

describe('Button', () => {
  describe.each(allVariants)('variant %s', variant => {
    describe.each(allSizes)('size %s', size => {
      it.snapshot(
        'without icon',
        () => (
          <Button variant={variant} size={size}>
            Button
          </Button>
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );

      it.snapshot(
        'with icon',
        () => (
          <Button variant={variant} size={size} icon={<IconEdit />}>
            Button
          </Button>
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );

      it.snapshot(
        'icon-only',
        () => (
          <Button variant={variant} size={size} icon={<IconEdit />} aria-label="Edit" />
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );
    });
  });
});

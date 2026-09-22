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
  function Wrapper({children}: {children: React.ReactNode}) {
    // Padding prevents rootElement.screenshot() from clipping shadows and focus rings.
    return <div style={{padding: 8}}>{children}</div>;
  }

  describe.each(allVariants)('variant %s', variant => {
    describe.each(allSizes)('size %s', size => {
      it.snapshot(
        'without icon',
        () => (
          <Wrapper>
            <Button variant={variant} size={size}>
              Button
            </Button>
          </Wrapper>
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );

      it.snapshot(
        'with icon',
        () => (
          <Wrapper>
            <Button variant={variant} size={size} icon={<IconEdit />}>
              Button
            </Button>
          </Wrapper>
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );

      it.snapshot(
        'icon-only',
        () => (
          <Wrapper>
            <Button variant={variant} size={size} icon={<IconEdit />} aria-label="Edit" />
          </Wrapper>
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );
    });
  });
});

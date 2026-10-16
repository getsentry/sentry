import {IconGrabbable} from '@sentry/icons/grabbable';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import type {IconSize} from '@sentry/scraps/theme';

import {t} from 'sentry/locale';

type DragReorderButtonProps = Omit<ButtonProps, 'children'> & {
  iconSize?: IconSize;
};

export function DragReorderButton({
  size = 'zero',
  iconSize = 'xs',
  ref,
  ...props
}: DragReorderButtonProps) {
  return (
    <Button
      aria-label={t('Drag to reorder')}
      variant="transparent"
      size={size}
      style={{cursor: 'grab'}}
      icon={<IconGrabbable size={iconSize} />}
      ref={ref}
      {...props}
    />
  );
}

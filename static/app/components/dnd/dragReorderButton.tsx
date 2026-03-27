import {Button, type ButtonProps} from '@sentry/scraps/button';

import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IconSize} from 'sentry/utils/theme';

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
      priority="transparent"
      size={size}
      style={{cursor: 'grab'}}
      icon={<IconGrabbable size={iconSize} />}
      ref={ref}
      {...props}
    />
  );
}

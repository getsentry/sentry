import type {MouseEventHandler} from 'react';

import {Button} from 'sentry/components/core/button';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  onDelete: MouseEventHandler<Element>;
}

export function DeleteButton({onDelete}: Props) {
  return (
    <Button
      size="zero" redesign
      borderless
      onClick={onDelete}
      icon={<IconDelete redesign />}
      title={t('Remove this Y-Axis')}
      aria-label={t('Remove this Y-Axis')}
    />
  );
}

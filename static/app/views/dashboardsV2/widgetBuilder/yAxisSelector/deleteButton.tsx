import {MouseEventHandler} from 'react';

import Button from 'sentry/components/button';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  onDelete: MouseEventHandler<Element>;
};

export function DeleteButton({onDelete}: Props) {
  return (
    <Button
      size="zero"
      borderless
      onClick={onDelete}
      icon={<IconDelete />}
      title={t('Remove this Y-Axis')}
      aria-label={t('Remove this Y-Axis')}
    />
  );
}

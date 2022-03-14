import * as React from 'react';

import Button, {ButtonProps} from 'sentry/components/button';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

interface DeleteActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  index: number;
  onClick: (triggerIndex: number, index: number, e: React.MouseEvent) => void;
  triggerIndex: number;
}

export default function DeleteActionButton(
  props: DeleteActionButtonProps
): React.ReactElement {
  const handleClick = (e: React.MouseEvent) => {
    const {triggerIndex, index, onClick} = props;
    onClick(triggerIndex, index, e);
  };

  return (
    <Button
      type="button"
      size="small"
      icon={<IconDelete size="xs" />}
      aria-label={t('Remove action')}
      {...props}
      onClick={handleClick}
    />
  );
}

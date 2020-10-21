import * as React from 'react';

import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';

type Props = Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  index: number;
  triggerIndex: number;
  onClick: (triggerIndex: number, index: number, e: React.MouseEvent) => void;
};

export default function DeleteActionButton(props: Props) {
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

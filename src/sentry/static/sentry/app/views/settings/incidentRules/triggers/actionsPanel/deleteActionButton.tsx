import React from 'react';
import {t} from 'app/locale';
import Button from 'app/components/button';

type Props = Omit<Button['props'], 'onClick'> & {
  index: number;
  onClick: (index: number, e: React.MouseEvent) => void;
};

export default function DeleteActionButton(props: Props) {
  const handleClick = (e: React.MouseEvent) => {
    const {index, onClick} = props;
    onClick(index, e);
  };

  return (
    <Button
      type="button"
      size="xsmall"
      icon="icon-trash"
      aria-label={t('Remove action')}
      {...props}
      onClick={handleClick}
    />
  );
}

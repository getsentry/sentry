import {Button, ButtonProps} from 'sentry/components/button';
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
      size="sm"
      icon={<IconDelete />}
      aria-label={t('Remove action')}
      {...props}
      onClick={handleClick}
    />
  );
}

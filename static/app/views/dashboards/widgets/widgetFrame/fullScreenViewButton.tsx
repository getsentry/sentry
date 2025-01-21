import {Button} from 'sentry/components/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';

export interface FullScreenViewButtonProps {
  onClick?: () => void | Promise<void>;
}

export function FullScreenViewButton(props: FullScreenViewButtonProps) {
  return (
    <Button
      aria-label={t('Open Full-Screen View')}
      borderless
      size="xs"
      icon={<IconExpand />}
      onClick={() => {
        props.onClick?.();
      }}
    />
  );
}

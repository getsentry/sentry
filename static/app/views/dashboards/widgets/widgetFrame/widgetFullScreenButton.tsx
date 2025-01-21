import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';

import {WidgetButton} from './widgetButton';

export interface WidgetFullScreenButtonProps {
  onClick?: () => void | Promise<void>;
}

export function WidgetFullScreenButton(props: WidgetFullScreenButtonProps) {
  return (
    <WidgetButton
      aria-label={t('Open Full-Screen View')}
      borderless
      icon={<IconExpand />}
      onClick={() => {
        props.onClick?.();
      }}
    />
  );
}

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';

interface Props {
  onClick: () => void;
  widgetIsOpen: boolean;
}

export function ReplayWidgetsToggleButton({onClick, widgetIsOpen}: Props) {
  return (
    <Button onClick={onClick}>
      {widgetIsOpen ? t('Hide Widgets') : t('Show Widgets')}
    </Button>
  );
}

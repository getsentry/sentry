import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';

interface ExpandAllButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ExpandAllButton({isExpanded, onToggle}: ExpandAllButtonProps) {
  return (
    <Button size="xs" onClick={onToggle}>
      {isExpanded ? t('Collapse all') : t('Expand all')}
    </Button>
  );
}

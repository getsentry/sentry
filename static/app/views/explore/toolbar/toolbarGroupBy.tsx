import {t} from 'sentry/locale';

import {ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarGroupByProps {
  disabled?: boolean;
}

export function ToolbarGroupBy({disabled}: ToolbarGroupByProps) {
  return (
    <ToolbarSection>
      <ToolbarHeading disabled={disabled}>{t('Group By')}</ToolbarHeading>
    </ToolbarSection>
  );
}

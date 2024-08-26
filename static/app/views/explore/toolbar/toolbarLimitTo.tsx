import {t} from 'sentry/locale';

import {ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarLimitToProps {}

export function ToolbarLimitTo({}: ToolbarLimitToProps) {
  return (
    <ToolbarSection>
      <ToolbarHeading>{t('Limit To')}</ToolbarHeading>
    </ToolbarSection>
  );
}

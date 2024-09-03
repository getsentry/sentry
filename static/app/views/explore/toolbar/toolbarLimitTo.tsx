import {t} from 'sentry/locale';

import {ToolbarHeader, ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarLimitToProps {}

export function ToolbarLimitTo({}: ToolbarLimitToProps) {
  return (
    <ToolbarSection>
      <ToolbarHeader>
        <ToolbarHeading>{t('Limit To')}</ToolbarHeading>
      </ToolbarHeader>
    </ToolbarSection>
  );
}

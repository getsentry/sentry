import {t} from 'sentry/locale';

import {ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarVisualizeProps {}

export function ToolbarVisualize({}: ToolbarVisualizeProps) {
  return (
    <ToolbarSection>
      <ToolbarHeading>{t('Visualize')}</ToolbarHeading>
    </ToolbarSection>
  );
}

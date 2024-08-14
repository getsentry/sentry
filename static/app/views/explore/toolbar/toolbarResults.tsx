import {t} from 'sentry/locale';

import {ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarResultsProps {}

export function ToolbarResults({}: ToolbarResultsProps) {
  return (
    <ToolbarSection data-test-id="section-result-mode">
      <ToolbarHeading>{t('Results')}</ToolbarHeading>
    </ToolbarSection>
  );
}

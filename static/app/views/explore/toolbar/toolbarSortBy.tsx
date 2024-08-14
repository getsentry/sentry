import {t} from 'sentry/locale';

import {ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarSortByProps {}

export function ToolbarSortBy({}: ToolbarSortByProps) {
  return (
    <ToolbarSection data-test-id="section-sort-by">
      <ToolbarHeading>{t('Sort By')}</ToolbarHeading>
    </ToolbarSection>
  );
}

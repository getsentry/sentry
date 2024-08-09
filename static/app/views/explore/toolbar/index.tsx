import {t} from 'sentry/locale';

import {ToolbarHeading, ToolbarSection} from './styles';

interface ExploreToolbarProps {}

export function ExploreToolbar({}: ExploreToolbarProps) {
  return (
    <div>
      <ToolbarResults />
      <ToolbarVisualize />
      <ToolbarSortBy />
      <ToolbarLimitTo />
      <ToolbarGroupBy disabled />
    </div>
  );
}

interface ToolbarResultsProps {}

function ToolbarResults({}: ToolbarResultsProps) {
  return (
    <ToolbarSection>
      <ToolbarHeading>{t('Results')}</ToolbarHeading>
    </ToolbarSection>
  );
}

interface ToolbarVisualizeProps {}

function ToolbarVisualize({}: ToolbarVisualizeProps) {
  return (
    <ToolbarSection>
      <ToolbarHeading>{t('Visualize')}</ToolbarHeading>
    </ToolbarSection>
  );
}

interface ToolbarSortByProps {}

function ToolbarSortBy({}: ToolbarSortByProps) {
  return (
    <ToolbarSection>
      <ToolbarHeading>{t('Sort By')}</ToolbarHeading>
    </ToolbarSection>
  );
}

interface ToolbarLimitToProps {}

function ToolbarLimitTo({}: ToolbarLimitToProps) {
  return (
    <ToolbarSection>
      <ToolbarHeading>{t('Limit To')}</ToolbarHeading>
    </ToolbarSection>
  );
}

interface ToolbarGroupByProps {
  disabled?: boolean;
}

function ToolbarGroupBy({disabled}: ToolbarGroupByProps) {
  return (
    <ToolbarSection>
      <ToolbarHeading disabled={disabled}>{t('Group By')}</ToolbarHeading>
    </ToolbarSection>
  );
}

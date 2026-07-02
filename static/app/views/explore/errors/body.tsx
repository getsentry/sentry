import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconDownload, IconSettings} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import {
  ExploreContentSection,
  ExploreControlSection,
} from 'sentry/views/explore/components/styles';
import {ErrorsCharts} from 'sentry/views/explore/errors/charts';
import {ErrorsToolbar} from 'sentry/views/explore/errors/toolbar';
import {ChevronButton} from 'sentry/views/explore/spans/spansTab';

interface ErrorsControlSectionProps {
  controlSectionExpanded: boolean;
}

export function ErrorsControlSection({
  controlSectionExpanded,
}: ErrorsControlSectionProps) {
  return (
    <ExploreControlSection expanded={controlSectionExpanded}>
      <ErrorsToolbar />
    </ExploreControlSection>
  );
}

interface ErrorsContentSectionProps {
  controlSectionExpanded: boolean;
  setControlSectionExpanded: (expanded: boolean) => void;
}

export function ErrorsContentSection({
  controlSectionExpanded,
  setControlSectionExpanded,
}: ErrorsContentSectionProps) {
  return (
    <ExploreContentSection gap="md">
      <OverChartButtonGroup>
        <ChevronButton
          aria-label={
            controlSectionExpanded ? t('Collapse sidebar') : t('Expand sidebar')
          }
          expanded={controlSectionExpanded}
          size="xs"
          icon={
            <IconChevron
              isDouble
              direction={controlSectionExpanded ? 'left' : 'right'}
              size="xs"
            />
          }
          onClick={() => setControlSectionExpanded(!controlSectionExpanded)}
        >
          {controlSectionExpanded ? null : t('Advanced')}
        </ChevronButton>
        <Flex gap="xs">
          <Button size="xs" aria-label={t('Export data')} icon={<IconDownload />}>
            {t('Export')}
          </Button>
          <Button size="xs" aria-label={t('Settings')} icon={<IconSettings />} />
        </Flex>
      </OverChartButtonGroup>
      <ErrorsCharts />
    </ExploreContentSection>
  );
}

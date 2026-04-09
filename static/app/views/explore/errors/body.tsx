import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import {
  ExploreContentSection,
  ExploreControlSection,
} from 'sentry/views/explore/components/styles';
import {ChevronButton} from 'sentry/views/explore/spans/spansTab';

interface ErrorsControlSectionProps {
  controlSectionExpanded: boolean;
}

export function ErrorsControlSection({
  controlSectionExpanded,
}: ErrorsControlSectionProps) {
  return <ExploreControlSection expanded={controlSectionExpanded} />;
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
    <ExploreContentSection>
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
      </OverChartButtonGroup>
    </ExploreContentSection>
  );
}

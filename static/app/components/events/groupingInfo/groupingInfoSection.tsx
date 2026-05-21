import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

interface EventGroupingInfoSectionProps {
  event: Event;
  group: Group | undefined;
  projectSlug: string;
  showGroupingConfig: boolean;
}

const LazyGroupingInfo = lazy(() => import('./groupingInfo'));

export function EventGroupingInfoSection({
  event,
  projectSlug,
  showGroupingConfig,
  group,
}: EventGroupingInfoSectionProps) {
  return (
    <FoldSection
      sectionKey={SectionKey.GROUPING_INFO}
      title={t('Event Grouping Information')}
      initialCollapse
    >
      <LazyLoad
        LazyComponent={LazyGroupingInfo}
        event={event}
        projectSlug={projectSlug}
        showGroupingConfig={showGroupingConfig}
        group={group}
      />
    </FoldSection>
  );
}

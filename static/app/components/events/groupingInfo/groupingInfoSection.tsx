import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

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
    <InterimSection
      title={t('Event Grouping Information')}
      type={SectionKey.GROUPING_INFO}
      initialCollapse
    >
      <LazyLoad
        LazyComponent={LazyGroupingInfo}
        event={event}
        projectSlug={projectSlug}
        showGroupingConfig={showGroupingConfig}
        group={group}
      />
    </InterimSection>
  );
}

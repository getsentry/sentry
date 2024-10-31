import {lazy, useState} from 'react';

import {GroupInfoSummary} from 'sentry/components/events/groupingInfo/groupingSummary';
import LazyLoad from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import SectionToggleButton from 'sentry/views/issueDetails/sectionToggleButton';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

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
  const hasStreamlinedUI = useHasStreamlinedUI();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <InterimSection
      title={t('Event Grouping Information')}
      actions={
        hasStreamlinedUI ? null : (
          <SectionToggleButton isExpanded={isOpen} onExpandChange={setIsOpen} />
        )
      }
      type={SectionKey.GROUPING_INFO}
      initialCollapse
    >
      {!hasStreamlinedUI && (
        <GroupInfoSummary event={event} group={group} projectSlug={projectSlug} />
      )}
      {hasStreamlinedUI || isOpen ? (
        <LazyLoad
          LazyComponent={LazyGroupingInfo}
          event={event}
          projectSlug={projectSlug}
          showGroupingConfig={showGroupingConfig}
          group={group}
        />
      ) : null}
    </InterimSection>
  );
}

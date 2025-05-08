import styled from '@emotion/styled';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {LinkButton} from 'sentry/components/core/button';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';

export const enum TraceContextSectionKeys {
  TAGS = 'trace-context-tags',
  VITALS = 'trace-context-web-vitals',
  LOGS = 'trace-context-logs',
  PROFILES = 'trace-context-profiles',
  SUMMARY = 'trace-context-summary',
}

const sectionLabels: Partial<Record<TraceContextSectionKeys, string>> = {
  [TraceContextSectionKeys.TAGS]: t('Tags'),
  [TraceContextSectionKeys.VITALS]: t('Vitals'),
  [TraceContextSectionKeys.LOGS]: t('Logs'),
  [TraceContextSectionKeys.PROFILES]: t('Profiles'),
  [TraceContextSectionKeys.SUMMARY]: t('Summary'),
};

function SectionLink({
  sectionKey,
  location,
}: {
  location: Location;
  sectionKey: TraceContextSectionKeys;
}) {
  const sectionLabel = sectionLabels[sectionKey];

  return (
    <StyledLinkButton
      to={{
        ...location,
        hash: `#${sectionKey}`,
      }}
      onClick={() => {
        document
          .getElementById(sectionKey)
          ?.scrollIntoView({block: 'start', behavior: 'smooth'});
      }}
      borderless
      size="xs"
      analyticsEventName="Trace View: Jump To Clicked"
      analyticsEventKey="trace_view.jump_to_clicked"
      analyticsParams={{section: sectionKey}}
    >
      {sectionLabel}
    </StyledLinkButton>
  );
}

function ScrollToSectionLinks({
  rootEventResults,
  tree,
  logs,
}: {
  logs: OurLogsResponseItem[];
  rootEventResults: TraceRootEventQueryResults;
  tree: TraceTree;
}) {
  const location = useLocation();
  const {hasVitals, hasProfiles, hasLogs, hasTags} = useTraceContextSections({
    tree,
    rootEventResults,
    logs,
  });

  return hasVitals || hasTags || hasProfiles || hasLogs ? (
    <StyledScrollCarousel gap={1} aria-label={t('Jump to:')}>
      <div aria-hidden>{t('Jump to:')}</div>
      {hasVitals && (
        <SectionLink sectionKey={TraceContextSectionKeys.VITALS} location={location} />
      )}
      {hasTags && (
        <SectionLink sectionKey={TraceContextSectionKeys.TAGS} location={location} />
      )}
      {hasProfiles && (
        <SectionLink sectionKey={TraceContextSectionKeys.PROFILES} location={location} />
      )}
      <Feature features={['ourlogs-enabled']}>
        {hasLogs && (
          <SectionLink sectionKey={TraceContextSectionKeys.LOGS} location={location} />
        )}
      </Feature>
      <Feature features={['single-trace-summary']}>
        <SectionLink sectionKey={TraceContextSectionKeys.SUMMARY} location={location} />
      </Feature>
    </StyledScrollCarousel>
  ) : null;
}

const StyledScrollCarousel = styled(ScrollCarousel)`
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledLinkButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default ScrollToSectionLinks;

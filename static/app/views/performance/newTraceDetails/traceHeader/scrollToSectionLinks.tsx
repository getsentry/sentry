import styled from '@emotion/styled';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {LinkButton} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {treeHasValidVitals} from 'sentry/views/performance/newTraceDetails/traceContextVitals';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export const enum TraceContextSectionKeys {
  TAGS = 'trace-context-tags',
  WEB_VITALS = 'trace-context-web-vitals',
  LOGS = 'trace-context-logs',
  PROFILES = 'trace-context-profiles',
  SUMMARY = 'trace-context-summary',
}

const sectionLabels: Partial<Record<TraceContextSectionKeys, string>> = {
  [TraceContextSectionKeys.TAGS]: t('Tags'),
  [TraceContextSectionKeys.WEB_VITALS]: t('Web Vitals'),
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

function ScrollToSectionLinks({tree}: {tree: TraceTree}) {
  const location = useLocation();
  const hasValidVitals = treeHasValidVitals(tree);
  const hasProfiles = tree.profiled_events.size > 0;

  return (
    <Wrapper>
      <div aria-hidden>{t('Jump to:')}</div>
      {hasValidVitals && (
        <SectionLink
          sectionKey={TraceContextSectionKeys.WEB_VITALS}
          location={location}
        />
      )}
      <SectionLink sectionKey={TraceContextSectionKeys.TAGS} location={location} />
      {hasProfiles && (
        <SectionLink sectionKey={TraceContextSectionKeys.PROFILES} location={location} />
      )}
      <Feature features={['ourlogs-enabled']}>
        <SectionLink sectionKey={TraceContextSectionKeys.LOGS} location={location} />
      </Feature>
      <Feature features={['single-trace-summary']}>
        <SectionLink sectionKey={TraceContextSectionKeys.SUMMARY} location={location} />
      </Feature>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
`;

const StyledLinkButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default ScrollToSectionLinks;

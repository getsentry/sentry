import styled from '@emotion/styled';
import type {Location} from 'history';

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
}

const sectionLabels: Partial<Record<TraceContextSectionKeys, string>> = {
  [TraceContextSectionKeys.TAGS]: t('Tags'),
  [TraceContextSectionKeys.WEB_VITALS]: t('Web Vitals'),
  [TraceContextSectionKeys.LOGS]: t('Logs'),
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
      <SectionLink sectionKey={TraceContextSectionKeys.LOGS} location={location} />
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

import {useMemo} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  SectionKey,
  useIssueDetails,
  type SectionConfig,
} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';

const sectionLabels: Partial<Record<SectionKey, string>> = {
  [SectionKey.HIGHLIGHTS]: t('Highlights'),
  [SectionKey.STACKTRACE]: t('Stack Trace'),
  [SectionKey.EXCEPTION]: t('Stack Trace'),
  [SectionKey.THREADS]: t('Stack Trace'),
  [SectionKey.REPLAY]: t('Replay'),
  [SectionKey.BREADCRUMBS]: t('Breadcrumbs'),
  [SectionKey.TRACE]: t('Trace'),
  [SectionKey.LOGS]: t('Logs'),
  [SectionKey.METRICS]: t('Metrics'),
  [SectionKey.TAGS]: t('Tags'),
  [SectionKey.CONTEXTS]: t('Context'),
  [SectionKey.USER_FEEDBACK]: t('User Feedback'),
  [SectionKey.FEATURE_FLAGS]: t('Flags'),
};

export function IssueDetailsJumpTo() {
  const {sectionData} = useIssueDetails();
  const organization = useOrganization();

  const excludedSectionKeys = useMemo(() => {
    const features = organization.features ?? [];
    const excluded: SectionKey[] = [];
    if (!features.includes('performance-view')) {
      excluded.push(SectionKey.TRACE);
    }
    if (!features.includes('ourlogs-enabled')) {
      excluded.push(SectionKey.LOGS);
    }
    if (!features.includes('tracemetrics-enabled')) {
      excluded.push(SectionKey.METRICS);
    }
    return excluded;
  }, [organization.features]);

  const eventSectionConfigs = useMemo(() => {
    const configs = Object.values(sectionData ?? {}).filter(
      config => sectionLabels[config.key] && !excludedSectionKeys.includes(config.key)
    );

    // Build a position map by querying the DOM once
    const positionMap = new Map<SectionKey, number>();
    configs.forEach(config => {
      const element = document.getElementById(config.key);
      if (element) {
        // Use offsetTop as a proxy for vertical position in the document
        positionMap.set(config.key, element.offsetTop);
      }
    });

    // Sort by the actual DOM order of sections on the page
    return configs.sort((a, b) => {
      const posA = positionMap.get(a.key);
      const posB = positionMap.get(b.key);

      // If either element doesn't exist yet, maintain current order
      if (posA === undefined || posB === undefined) {
        return 0;
      }

      return posA - posB;
    });
  }, [sectionData, excludedSectionKeys]);

  if (eventSectionConfigs.length === 0) {
    return null;
  }

  return (
    <JumpTo>
      <JumpToLabel aria-hidden>{t('Jump to:')}</JumpToLabel>
      <ScrollCarousel gap={0.25} aria-label={t('Jump to section links')}>
        {eventSectionConfigs.map(config => (
          <JumpToLink key={config.key} config={config} />
        ))}
      </ScrollCarousel>
    </JumpTo>
  );
}

function JumpToLink({config}: {config: SectionConfig}) {
  const theme = useTheme();
  const [_isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(config.key),
    config?.initialCollapse ?? false
  );
  return (
    <LinkButton
      to={{
        ...location,
        hash: `#${config.key}`,
      }}
      onClick={event => {
        // If command click do nothing, assume user wants to open in new tab
        if (event.metaKey || event.ctrlKey) {
          return;
        }

        setIsCollapsed(false);
        // Animation frame avoids conflicting with react-router ScrollRestoration
        requestAnimationFrame(() => {
          document
            .getElementById(config.key)
            ?.scrollIntoView({block: 'start', behavior: 'smooth'});
        });
      }}
      borderless
      size="xs"
      css={css`
        color: ${theme.subText};
        font-weight: ${theme.fontWeight.normal};
      `}
      analyticsEventName="Issue Details: Jump To Clicked"
      analyticsEventKey="issue_details.jump_to_clicked"
      analyticsParams={{section: config.key}}
    >
      {sectionLabels[config.key]}
    </LinkButton>
  );
}

const JumpToLabel = styled('div')`
  margin-top: ${p => p.theme.space['2xs']};
`;

const JumpTo = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xs};
  flex-direction: row;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  white-space: nowrap;
  overflow: hidden;
`;

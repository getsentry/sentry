import {useCallback} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

const LOCAL_STORAGE_PREFIX = 'issue-details-collapse-';
export const enum SectionKey {
  HIGHLIGHTS = 'highlights',
  STACK_TRACE = 'stack-trace',
  BREADCRUMBS = 'breadcrumbs',
  TAGS = 'tags',
  CONTEXTS = 'contexts',
}

interface FoldSectionProps {
  children: React.ReactNode;
  sectionKey: SectionKey;
  title: React.ReactNode;
  initialCollapse?: boolean;
  preventCollapse?: boolean;
}

export function FoldSection({
  children,
  title,
  sectionKey,
  initialCollapse = false,
  preventCollapse = false,
  ...props
}: FoldSectionProps) {
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    `${LOCAL_STORAGE_PREFIX}${sectionKey}`,
    initialCollapse
  );

  const toggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent browser summary/details behaviour
      setIsCollapsed(collapsed => !collapsed);
    },
    [setIsCollapsed]
  );

  return (
    <section {...props}>
      <Details open={!isCollapsed || preventCollapse}>
        <Summary
          preventCollapse={preventCollapse}
          onClick={preventCollapse ? e => e.preventDefault() : toggleCollapse}
        >
          <InteractionStateLayer hidden={preventCollapse} />
          <div>{title}</div>
          <IconWrapper preventCollapse={preventCollapse}>
            <IconChevron direction={isCollapsed ? 'up' : 'down'} size="xs" />
          </IconWrapper>
        </Summary>
        {children}
      </Details>
    </section>
  );
}

const Details = styled('details')`
  margin: ${space(1)} ${space(0.75)};
`;

const Summary = styled('summary')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: ${p => (p.preventCollapse ? 'initial' : 'pointer')};
  position: relative;
`;

const IconWrapper = styled('div')<{preventCollapse: boolean}>`
  color: ${p => p.theme.subText};
  line-height: 0;
  visibility: ${p => (p.preventCollapse ? 'hidden' : 'initial')};
`;

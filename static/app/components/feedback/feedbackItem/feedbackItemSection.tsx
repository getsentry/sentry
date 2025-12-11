import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

interface Props {
  children: ReactNode;
  sectionKey: string;
  collapsible?: boolean;
  icon?: ReactNode;
  title?: ReactNode;
}

export default function FeedbackItemSection({
  children,
  sectionKey,
  collapsible,
  icon,
  title,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    `feedback-details-fold-section-collapse:${sectionKey}`,
    false
  );
  return (
    <SectionWrapper>
      {title ? (
        <SectionTitle
          onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? t('Expand') : t('Collapse')}
        >
          <InteractionStateLayer hasSelectedBackground={false} hidden={!collapsible} />
          <LeftAlignedContent>
            {icon}
            {title}
          </LeftAlignedContent>
          {collapsible ? (
            <IconChevron direction={isCollapsed ? 'down' : 'up'} size="xs" />
          ) : null}
        </SectionTitle>
      ) : null}
      {isCollapsed ? null : children}
    </SectionWrapper>
  );
}

const SectionWrapper = styled('section')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  position: relative;
`;

const SectionTitle = styled('h3')`
  margin: 0;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.md};
  text-transform: capitalize;
  user-select: none;

  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  justify-content: space-between;
  position: relative;

  padding: ${space(1)} ${space(0.75)};
  margin-inline: -${space(1)} -${space(0.75)};
  border-radius: ${p => p.theme.radius.md};
`;

const LeftAlignedContent = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

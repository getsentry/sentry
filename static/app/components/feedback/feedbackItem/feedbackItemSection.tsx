import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex, Stack} from '@sentry/scraps/layout';

import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

interface Props {
  children: ReactNode;
  sectionKey: string;
  actions?: ReactNode;
  collapsible?: boolean;
  icon?: ReactNode;
  title?: ReactNode;
}

export function FeedbackItemSection({
  children,
  sectionKey,
  actions,
  collapsible,
  icon,
  title,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    `feedback-details-fold-section-collapse:${sectionKey}`,
    false
  );
  return (
    <Stack as="section" gap="md" position="relative">
      {title ? (
        <SectionTitle
          onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? t('Expand') : t('Collapse')}
        >
          <InteractionStateLayer hasSelectedBackground={false} hidden={!collapsible} />
          <Flex align="center" gap="xs">
            {icon}
            {title}
          </Flex>
          <Flex align="center" gap="sm">
            {actions ? (
              <Flex onClick={event => event.stopPropagation()}>{actions}</Flex>
            ) : null}
            {collapsible ? (
              <IconChevron direction={isCollapsed ? 'down' : 'up'} size="xs" />
            ) : null}
          </Flex>
        </SectionTitle>
      ) : null}
      {isCollapsed ? null : children}
    </Stack>
  );
}

const SectionTitle = styled('h3')`
  margin: 0;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.md};
  text-transform: capitalize;
  user-select: none;

  display: flex;
  gap: ${p => p.theme.space.xs};
  align-items: center;
  justify-content: space-between;
  position: relative;

  padding: ${p => p.theme.space.md} ${p => p.theme.space.sm};
  margin-inline: -${p => p.theme.space.md} -${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};
`;

import styled from '@emotion/styled';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {GroupIntegrationIssueResult} from 'sentry/components/group/externalIssuesList/hooks/types';
import {t} from 'sentry/locale';

interface LinkedIssueRowsProps {
  linkedIssues: GroupIntegrationIssueResult['linkedIssues'];
}

interface LinkedIssueRowProps {
  linkedIssue: GroupIntegrationIssueResult['linkedIssues'][number];
}

const DEFAULT_ICON_OFFSET = -1;

export function LinkedIssueRows({linkedIssues}: LinkedIssueRowsProps) {
  return (
    <Stack
      as="ul"
      aria-label={t('Linked issues')}
      border="primary"
      radius="md"
      overflow="hidden"
      margin="0"
      padding="0"
    >
      {linkedIssues.map((linkedIssue, index) => (
        <Container
          as="li"
          key={linkedIssue.key}
          borderTop={index === 0 ? undefined : 'primary'}
          style={{listStyle: 'none'}}
        >
          <LinkedIssueRow linkedIssue={linkedIssue} />
        </Container>
      ))}
    </Stack>
  );
}

function LinkedIssueRow({linkedIssue}: LinkedIssueRowProps) {
  const title = linkedIssue.title || linkedIssue.displayName;
  const displayTitle = linkedIssue.displayName || title;
  const hasHiddenTitle = displayTitle !== title;

  return (
    <LinkedIssueRowGrid>
      <InteractionStateLayer />
      <LinkedIssueRowLink href={linkedIssue.url}>
        <Flex
          as="span"
          display="inline-flex"
          justify="center"
          align="center"
          flexShrink={0}
          width="14px"
          height="14px"
          aria-hidden
          style={{
            transform: `translateY(${linkedIssue.displayIconOffset ?? DEFAULT_ICON_OFFSET}px)`,
          }}
        >
          {linkedIssue.displayIcon}
        </Flex>
        <Container
          as="span"
          display="block"
          width="100%"
          minWidth="0"
          maxWidth="100%"
          overflow="hidden"
        >
          <Tooltip
            title={
              <Text as="span" align="left" wordBreak="break-word">
                {title}
              </Text>
            }
            disabled={!hasHiddenTitle}
            maxWidth={275}
            skipWrapper
          >
            <LinkedIssueRowTitle>{displayTitle}</LinkedIssueRowTitle>
          </Tooltip>
        </Container>
      </LinkedIssueRowLink>
      <Flex as="span" align="center" padding="xs sm" paddingLeft="0" paddingRight="xs">
        <Tooltip title={t('Unlink issue')} skipWrapper>
          <Button
            aria-label={t('Unlink %s', displayTitle)}
            icon={<IconClose variant="muted" />}
            onClick={linkedIssue.onUnlink}
            size="zero"
            variant="transparent"
          />
        </Tooltip>
      </Flex>
    </LinkedIssueRowGrid>
  );
}

const LinkedIssueRowGrid = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: stretch;
  overflow: hidden;
  color: ${p => p.theme.tokens.content.primary};
`;

const LinkedIssueRowLink = styled(ExternalLink)`
  position: relative;
  display: grid;
  align-items: center;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: ${p => p.theme.space.sm};
  min-width: 0;
  max-width: 100%;
  width: 100%;
  overflow: hidden;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const LinkedIssueRowTitle = styled('span')`
  display: block;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  direction: rtl;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

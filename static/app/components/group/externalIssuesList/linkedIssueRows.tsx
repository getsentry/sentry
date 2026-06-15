import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {GroupIntegrationIssueResult} from 'sentry/components/group/externalIssuesList/hooks/types';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

interface LinkedIssueRowsProps {
  linkedIssues: GroupIntegrationIssueResult['linkedIssues'];
}

interface LinkedIssueRowProps {
  linkedIssue: GroupIntegrationIssueResult['linkedIssues'][number];
}

export function LinkedIssueRows({linkedIssues}: LinkedIssueRowsProps) {
  return (
    <Flex
      as="ul"
      aria-label={t('Linked issues')}
      direction="column"
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
    </Flex>
  );
}

function LinkedIssueRow({linkedIssue}: LinkedIssueRowProps) {
  const title = linkedIssue.title || linkedIssue.displayName;
  const subtitle =
    linkedIssue.displayName &&
    !title.toLocaleLowerCase().includes(linkedIssue.displayName.toLocaleLowerCase())
      ? linkedIssue.displayName
      : null;
  const hasSubtitle = Boolean(subtitle);

  return (
    <LinkedIssueRowGrid>
      <InteractionStateLayer />
      <LinkedIssueRowLink
        aria-label={subtitle ? t('%s, %s', title, subtitle) : title}
        href={linkedIssue.url}
      >
        <Grid
          align={hasSubtitle ? 'start' : 'center'}
          columns="max-content minmax(0, 1fr)"
          gap="sm"
          padding={hasSubtitle ? 'sm' : 'xs sm'}
          width="100%"
        >
          <LinkedIssueRowIcon
            aria-hidden
            hasSubtitle={hasSubtitle}
            style={hasSubtitle ? undefined : {transform: 'translateY(-1px)'}}
          >
            {linkedIssue.displayIcon}
          </LinkedIssueRowIcon>
          <Flex as="span" direction="column" gap={hasSubtitle ? '2xs' : '0'} minWidth={0}>
            <LinkedIssueRowTitle title={title}>{title}</LinkedIssueRowTitle>
            {subtitle && (
              <Text as="span" ellipsis size="sm" title={subtitle} variant="muted">
                {subtitle}
              </Text>
            )}
          </Flex>
        </Grid>
      </LinkedIssueRowLink>
      <Flex
        as="span"
        align="center"
        padding={hasSubtitle ? 'sm' : 'xs sm'}
        paddingLeft="0"
        paddingRight="xs"
      >
        <Tooltip title={t('Unlink issue')} skipWrapper>
          <Button
            aria-label={t('Unlink %s', title)}
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
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const LinkedIssueRowIcon = styled('span', {
  shouldForwardProp: prop => prop !== 'hasSubtitle',
})<{hasSubtitle: boolean}>`
  display: inline-flex;
  align-items: ${p => (p.hasSubtitle ? 'flex-start' : 'center')};
  justify-content: center;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  padding-top: ${p => (p.hasSubtitle ? p.theme.space['2xs'] : 0)};
`;

const LinkedIssueRowTitle = styled('span')`
  display: block;
  overflow: hidden;
  width: 100%;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

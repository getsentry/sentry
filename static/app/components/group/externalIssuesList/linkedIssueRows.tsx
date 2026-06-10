import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {GroupIntegrationIssueResult} from 'sentry/components/group/externalIssuesList/hooks/types';
import {IconDelete} from 'sentry/icons';
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
          <Flex
            as="span"
            aria-hidden
            align={hasSubtitle ? 'start' : 'center'}
            display="inline-flex"
            paddingTop={hasSubtitle ? '2xs' : undefined}
            style={hasSubtitle ? undefined : {transform: 'translateY(-1px)'}}
          >
            {linkedIssue.displayIcon}
          </Flex>
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
      >
        <Tooltip title={t('Unlink issue')} skipWrapper>
          <Button
            aria-label={t('Unlink %s', title)}
            icon={<IconDelete />}
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: stretch;
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const LinkedIssueRowLink = styled(ExternalLink)`
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const LinkedIssueRowTitle = styled('span')`
  display: block;
  overflow: hidden;
  width: 100%;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-ligatures: no-common-ligatures;
  font-feature-settings: 'liga' 0;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

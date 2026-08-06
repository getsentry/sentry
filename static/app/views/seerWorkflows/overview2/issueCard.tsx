import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {TimeSince} from 'sentry/components/timeSince';
import {IconCommit, IconFocus, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {OverviewRun} from './types';

const TitleLink = styled(Link)`
  color: inherit;
  &:hover {
    color: inherit;
    text-decoration: underline;
  }
`;

function NarrativeBlock({
  icon,
  label,
  variant,
  children,
}: {
  children: string;
  icon: React.ReactNode;
  label: string;
  variant: 'muted' | 'success';
}) {
  return (
    <Stack gap="xs" maxWidth="70ch">
      <Flex gap="xs" align="center">
        {icon}
        <Text size="xs" bold uppercase variant={variant}>
          {label}
        </Text>
      </Flex>
      <Text size={{xs: 'md', lg: 'lg'}} density="comfortable" wordBreak="break-word">
        {children}
      </Text>
    </Stack>
  );
}

export function Overview2Card({orgSlug, run}: {orgSlug: string; run: OverviewRun}) {
  const rootCause = run.rootCause?.oneLineDescription;
  const proposedFix = run.proposedFix?.oneLineSummary;

  return (
    <Container background="primary" border="primary" radius="md" padding="xl">
      <Flex
        gap={{xs: 'xl', sm: '3xl'}}
        align={{xs: 'stretch', sm: 'start'}}
        justify="between"
        direction={{xs: 'column-reverse', sm: 'row'}}
      >
        <Stack gap="lg" minWidth="0" flex="1">
          <Text bold display="block" textWrap="pretty" size="lg">
            <TitleLink to={`/organizations/${orgSlug}/issues/${run.groupId}/`}>
              {run.title}
            </TitleLink>
          </Text>
          {rootCause && (
            <NarrativeBlock
              icon={<IconFocus size="xs" variant="muted" aria-hidden />}
              label={t('Root cause')}
              variant="muted"
            >
              {rootCause}
            </NarrativeBlock>
          )}
          {proposedFix && (
            <NarrativeBlock
              icon={<IconCommit size="xs" variant="success" aria-hidden />}
              label={t('Proposed fix')}
              variant="success"
            >
              {proposedFix}
            </NarrativeBlock>
          )}
        </Stack>

        <Stack gap="xs" align="start" flexShrink={0} minWidth="0">
          <Text size="sm" monospace variant="muted" ellipsis>
            {run.shortId}
          </Text>
          <Flex gap="xs" align="center">
            <IconSeer size="xs" variant="muted" aria-hidden />
            <Text size="sm" variant="muted">
              <TimeSince
                date={run.lastTriggeredAt}
                tooltipPrefix={t('Last activity on this Seer run')}
              />
            </Text>
          </Flex>
        </Stack>
      </Flex>
    </Container>
  );
}

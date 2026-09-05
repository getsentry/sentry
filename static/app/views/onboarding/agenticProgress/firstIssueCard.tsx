import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getMessage, getTitle} from 'sentry/utils/events';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';

export function FirstIssueCard({issueId}: {issueId: string}) {
  const organization = useOrganization();
  const {data: group, isPending} = useQuery({
    ...groupApiOptions({
      groupId: issueId,
      organizationSlug: organization.slug,
      environments: [],
    }),
    retry: (failureCount, error) =>
      failureCount < 3 && error instanceof RequestError && error.status === 404,
    retryDelay: 2000,
  });

  if (isPending) {
    return <Placeholder height="112px" />;
  }

  if (!group) {
    return null;
  }

  const message = getMessage(group);

  return (
    <IssueCardLink
      to={`/organizations/${organization.slug}/issues/${group.id}/?referrer=onboarding-agentic-first-issue`}
    >
      <Grid columns="minmax(0, 1fr) max-content" gap="lg" align="center">
        <Stack gap="lg">
          <Heading as="h3" size="md" variant="accent">
            {t('Check out your first issue')}
          </Heading>
          <Stack gap="2xs">
            <Text size="lg" bold ellipsis>
              {getTitle(group).title}
            </Text>
            {message ? (
              <Text size="sm" variant="muted" ellipsis>
                {message}
              </Text>
            ) : null}
          </Stack>
        </Stack>
        <IconChevron direction="right" size="sm" variant="muted" />
      </Grid>
    </IssueCardLink>
  );
}

const IssueCardLink = styled(Link)`
  display: block;
  padding: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.lg};
  color: inherit;
  background: linear-gradient(
    90deg,
    ${p => p.theme.tokens.background.secondary},
    transparent
  );

  &:hover,
  &:focus-visible {
    color: inherit;
    border-color: ${p => p.theme.tokens.border.primary};
    background: linear-gradient(
      90deg,
      ${p => p.theme.tokens.background.secondary},
      ${p => p.theme.tokens.background.secondary}
    );
  }
`;

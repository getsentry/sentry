import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SectionIssueCard} from './sectionIssueCard';
import {type OverviewIssue, QUERY_STALE_TIME} from './types';

// Deep-link focus mode: ?id=<issueId> renders exactly that issue's card, fully
// expanded, fetched by group id so it resolves even outside the list's filters.
export function FocusedIssue({id, period}: {id: string; period: string}) {
  const organization = useOrganization();
  const location = useLocation();

  const pinnedIssueQuery = useQuery(
    apiOptions.as<OverviewIssue[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {group: [id], project: -1, statsPeriod: period},
      staleTime: QUERY_STALE_TIME,
    })
  );
  const issues = pinnedIssueQuery.data ?? [];

  return (
    <Fragment>
      {/* Focus mode swaps the filter toolbar for a way back to the list; every
          other param (project, sort, ...) is preserved. */}
      <Flex>
        <LinkButton
          size="xs"
          variant="transparent"
          icon={<IconArrow direction="left" size="xs" />}
          to={{
            pathname: location.pathname,
            query: {...location.query, id: undefined},
          }}
        >
          {t('All issues')}
        </LinkButton>
      </Flex>

      {pinnedIssueQuery.isError ? (
        <LoadingError onRetry={pinnedIssueQuery.refetch} />
      ) : pinnedIssueQuery.isPending ? (
        <LoadingIndicator />
      ) : issues.length === 0 ? (
        <Container border="primary" radius="md" padding="xl">
          <Text as="p" variant="muted" align="center">
            {t('Issue not found.')}
          </Text>
        </Container>
      ) : (
        <Stack gap="md">
          {issues.map(issue => (
            <SectionIssueCard
              key={issue.id}
              issue={issue}
              orgSlug={organization.slug}
              view="cards"
              statsPeriod={period}
              lazy={false}
            />
          ))}
        </Stack>
      )}
    </Fragment>
  );
}

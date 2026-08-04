import {useCallback, useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import type {TagVariant} from 'sentry/utils/theme/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  AUTOFIX_PHASE_LABELS,
  type AutofixIssue,
  type AutofixPhase,
  DEFAULT_ISSUE_QUERY,
  REQUIRED_ISSUE_FILTER,
  useAutofixIssues,
} from 'sentry/views/autofixIssuesDemo/useAutofixIssues';
import {IssueListSearchBar} from 'sentry/views/issueList/searchBar';

// Tag color per phase: neutral early, warning mid, promotion/success at PR.
const AUTOFIX_PHASE_VARIANTS: Record<AutofixPhase, TagVariant> = {
  rca: 'muted',
  planning: 'info',
  coding: 'warning',
  pr_open: 'promotion',
  pr_merged: 'success',
};

export default function AutofixIssuesDemo() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const query = decodeScalar(location.query.query, DEFAULT_ISSUE_QUERY);
  const cursor = decodeScalar(location.query.cursor);

  const {issues, isPending, isError, refetch, pageLinks} = useAutofixIssues({
    query,
    cursor,
  });

  const handleSearch = useCallback(
    (newQuery: string) => {
      navigate({
        pathname: location.pathname,
        query: {...location.query, query: newQuery, cursor: undefined},
      });
    },
    [navigate, location.pathname, location.query]
  );

  const columnOrder = useMemo<Array<GridColumnOrder<string>>>(
    () => [
      {key: 'issue', name: t('Issue'), width: 320},
      {key: 'status', name: t('Status'), width: 120},
      {key: 'fixability', name: t('Fixability'), width: 110},
      {key: 'lastRun', name: t('Last run'), width: 150},
      {key: 'outputs', name: t('Seer answers'), width: COL_WIDTH_UNDEFINED},
    ],
    []
  );

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, issue: AutofixIssue): React.ReactNode => {
      switch (column.key) {
        case 'issue':
          return (
            <Stack gap="2xs">
              <Link to={`/organizations/${organization.slug}/issues/${issue.id}/`}>
                {issue.shortId || issue.title}
              </Link>
              <Text variant="muted" size="sm" wordBreak="break-word">
                {issue.title}
              </Text>
            </Stack>
          );
        case 'status': {
          if (issue.autofixPhase) {
            return (
              <Tag variant={AUTOFIX_PHASE_VARIANTS[issue.autofixPhase]}>
                {AUTOFIX_PHASE_LABELS[issue.autofixPhase]}
              </Tag>
            );
          }
          return <Text variant="muted">{issue.autofixPhasePending ? '…' : '—'}</Text>;
        }
        case 'fixability':
          return (
            <Text>
              {typeof issue.seerFixabilityScore === 'number'
                ? issue.seerFixabilityScore.toFixed(2)
                : '—'}
            </Text>
          );
        case 'lastRun': {
          const lastRun = issue.run?.lastTriggeredAt ?? issue.seerAutofixLastTriggered;
          return lastRun ? (
            <TimeSince date={lastRun} />
          ) : (
            <Text variant="muted">{'—'}</Text>
          );
        }
        case 'outputs': {
          const answered = (issue.run?.outputs ?? []).filter(q => q.answer);
          if (answered.length === 0) {
            return <Text variant="muted">{'—'}</Text>;
          }
          return (
            <Stack gap="md">
              {answered.map(q => (
                <Stack key={q.key} gap="xs">
                  <Heading as="h4">{q.question ?? q.key}</Heading>
                  <SeerMarkdown raw={q.answer} />
                </Stack>
              ))}
            </Stack>
          );
        }
        default:
          return null;
      }
    },
    [organization.slug]
  );

  return (
    <SentryDocumentTitle title={t('Autofix Issues')} orgSlug={organization.slug}>
      <Stack gap="lg" padding="xl" paddingBottom="3xl">
        <Stack gap="2xs">
          <Heading as="h1">{t('Autofix Issues')}</Heading>
          <Text as="p" variant="muted">
            {t(
              'Issues Seer has run autofix on, enriched with each run and its one-shot answers.'
            )}
          </Text>
        </Stack>

        {/*
          Reuse the standard issue search bar. The required
          `has:issue.seer_last_run` filter is always applied on top by
          useAutofixIssues, so it isn't part of the editable query.
        */}
        <IssueListSearchBar
          organization={organization}
          searchSource="autofix_issues_demo"
          initialQuery={query}
          placeholder={t('Search %s issues', REQUIRED_ISSUE_FILTER)}
          onSearch={handleSearch}
        />

        {isError ? (
          <LoadingError onRetry={refetch} />
        ) : (
          <Container>
            <GridEditable
              isLoading={isPending}
              data={issues}
              columnOrder={columnOrder}
              columnSortBy={[]}
              grid={{
                renderHeadCell: column => column.name,
                renderBodyCell,
              }}
              emptyMessage={t('No autofix issues found for this organization.')}
            />
            <Pagination pageLinks={pageLinks} />
          </Container>
        )}

        {/* Clear the floating Seer button so it doesn't overlap the content. */}
        <Container height="80px" aria-hidden />
      </Stack>
    </SentryDocumentTitle>
  );
}

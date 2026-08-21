import {useCallback, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container, Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

// Default search applied when the URL has no ?query, scoping the demo to
// explorer runs from autofix.
const DEFAULT_QUERY = 'type:explorer source:autofix';

// Questions asked about each run, sent to the endpoint as repeatable `question`
// params (see organization_seer_runs.py). Edit this list to iterate on prompts
// without touching the built-in server-side set. Capped at 5 by the endpoint.
const DEMO_QUESTIONS = [
  'What is the root cause of this issue, in one sentence?',
  'What is the suggested fix?',
  'How confident are you in the diagnosis, and why?',
];

// Filter keys the runs endpoint understands. `is` and `type` have predefined
// values; `source`/`project` accept free text. Must be a stable reference.
const FILTER_KEYS: TagCollection = {
  is: {key: 'is', name: 'is', predefined: true, values: ['agent', 'mine']},
  type: {
    key: 'type',
    name: 'type',
    predefined: true,
    values: ['explorer', 'pr_review', 'assisted_query', 'feature_run'],
  },
  source: {key: 'source', name: 'source'},
  project: {key: 'project', name: 'project'},
};

// One answered question, mirrors the run output in
// src/sentry/api/serializers/models/seer_run.py.
interface RunQuestion {
  answer: string;
  key: string;
  // Digest of the question text; always present.
  hash?: string;
  // The question text, echoed back only for user questions.
  question?: string;
}

// Mirrors SeerRunResponse in src/sentry/api/serializers/models/seer_run.py.
interface SeerRun {
  dateCreated: string;
  groupId: string | null;
  id: string;
  lastTriggeredAt: string;
  projectId: string | null;
  source: string | null;
  title: string | null;
  type: string;
  userId: string | null;
  // Present only when ?expand=questions and/or ?question= is requested (feature on).
  outputs?: RunQuestion[];
}

export default function SeerRunsDemo() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const query = decodeScalar(location.query.query, DEFAULT_QUERY);
  const cursor = decodeScalar(location.query.cursor);

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<SeerRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {query, cursor, question: DEMO_QUESTIONS},
      staleTime: 30_000,
    }),
    select: selectJsonWithHeaders,
  });

  const runs = useMemo(() => data?.json ?? [], [data]);
  const pageLinks = data?.headers.Link;

  const handleSearch = useCallback(
    (newQuery: string) => {
      navigate({
        pathname: location.pathname,
        query: {...location.query, query: newQuery, cursor: undefined},
      });
    },
    [navigate, location.pathname, location.query]
  );

  // Predefined values (is:, type:) are supplied by the FILTER_KEYS definitions;
  // source/project are free text, so there are no async values to fetch.
  const getTagValues = useCallback<GetTagValues>(() => Promise.resolve([]), []);

  const columnOrder = useMemo<Array<GridColumnOrder<string>>>(
    () => [
      {key: 'title', name: t('Title'), width: 240},
      {key: 'type', name: t('Type'), width: 120},
      {key: 'source', name: t('Source'), width: 120},
      {key: 'lastTriggered', name: t('Last triggered'), width: 160},
      {key: 'outputs', name: t('Outputs'), width: COL_WIDTH_UNDEFINED},
    ],
    []
  );

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, run: SeerRun): React.ReactNode => {
      switch (column.key) {
        case 'title':
          return <Text>{run.title || t('Untitled %s run', run.type)}</Text>;
        case 'type':
          return <Text>{run.type}</Text>;
        case 'source':
          return <Text>{run.source ?? '—'}</Text>;
        case 'lastTriggered':
          return <TimeSince date={run.lastTriggeredAt} />;
        case 'outputs': {
          const answered = (run.outputs ?? []).filter(q => q.answer);
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
    []
  );

  return (
    <SentryDocumentTitle title={t('Seer Runs')} orgSlug={organization.slug}>
      <Stack gap="lg" padding="xl" paddingBottom="3xl">
        <Stack gap="2xs">
          <Heading as="h1">{t('Seer Runs')}</Heading>
          <Text as="p" variant="muted">
            {t('Recent Seer runs and one-shot answers to questions about each run.')}
          </Text>
        </Stack>

        <SearchQueryBuilder
          searchSource="seer_runs_demo"
          initialQuery={query}
          placeholder={t('Search by source, type, project, is:agent, is:mine, or title')}
          filterKeys={FILTER_KEYS}
          getTagValues={getTagValues}
          onSearch={handleSearch}
        />

        {isError ? (
          <LoadingError onRetry={refetch} />
        ) : (
          <Container>
            <GridEditable
              isLoading={isPending}
              data={runs}
              columnOrder={columnOrder}
              columnSortBy={[]}
              grid={{
                renderHeadCell: column => column.name,
                renderBodyCell,
              }}
              emptyMessage={t('No Seer runs found for this organization.')}
            />
            <Pagination pageLinks={pageLinks} />
          </Container>
        )}
      </Stack>
    </SentryDocumentTitle>
  );
}

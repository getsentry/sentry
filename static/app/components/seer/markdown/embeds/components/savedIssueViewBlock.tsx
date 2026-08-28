import {lazy, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {groupSearchViewApiOptions} from 'sentry/views/issueList/queries/groupSearchView';

import {SavedIssueViewLink} from './savedIssueViewLink';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

const MAX_PREVIEW_ISSUES = 5;
const PREVIEW_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'priority',
  'assignee',
];

export default function SavedIssueViewBlock({id, name}: EmbedOutput<'savedIssueView'>) {
  const organization = useOrganization();
  const {
    data: view,
    isError,
    isPending,
  } = useQuery(groupSearchViewApiOptions({id, orgSlug: organization.slug}));
  const queryParams = useMemo(
    () =>
      view ? {...getIssueViewQueryParams({view}), limit: MAX_PREVIEW_ISSUES} : undefined,
    [view]
  );

  return (
    <Container
      background="primary"
      border="primary"
      containerType="inline-size"
      padding="md"
      radius="md"
      width="100%"
    >
      <Stack gap="md">
        <SavedIssueViewLink id={id} name={view?.name ?? name} />
        {isPending ? (
          <Flex justify="center" padding="md">
            <LoadingIndicator mini />
          </Flex>
        ) : isError || !view || !queryParams ? (
          <Text variant="muted">{t('Unable to load saved issue view.')}</Text>
        ) : (
          <ErrorBoundary mini>
            <LazyLoad
              LazyComponent={LazyGroupList}
              canSelectGroups={false}
              numPlaceholderRows={3}
              query={view.query}
              queryParams={queryParams}
              source="seer-saved-issue-view-embed"
              staleTime={30_000}
              useFilteredStats
              withChart
              withColumns={PREVIEW_COLUMNS}
              withPagination={false}
            />
          </ErrorBoundary>
        )}
      </Stack>
    </Container>
  );
}

import {Fragment, lazy, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {groupSearchViewApiOptions} from 'sentry/views/issueList/queries/groupSearchView';

import {getSavedIssueViewHref} from './savedIssueViewLink';

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
  const href = getSavedIssueViewHref(id, organization.slug);
  const queryParams = useMemo(
    () =>
      view ? {...getIssueViewQueryParams({view}), limit: MAX_PREVIEW_ISSUES} : undefined,
    [view]
  );

  return (
    <SeerEmbedBlock
      href={href}
      icon={IconStar}
      linkLabel={t('View Issues')}
      testId="seer-saved-issue-view-embed"
      title={view?.name ?? name ?? t('Issue view %s', id)}
    >
      {isPending ? (
        <Flex justify="center" padding="md">
          <LoadingIndicator mini />
        </Flex>
      ) : isError || !view || !queryParams ? (
        <Text variant="muted">{t('Unable to load saved issue view.')}</Text>
      ) : (
        <Fragment>
          {view.query ? <ProvidedFormattedQuery query={view.query} /> : null}
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
        </Fragment>
      )}
    </SeerEmbedBlock>
  );
}

import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import {QueryEmbedIssueList} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedIssueList';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {groupSearchViewApiOptions} from 'sentry/views/issueList/queries/groupSearchView';

import {getSavedIssueViewHref} from './savedIssueViewLink';

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
      view
        ? {...getIssueViewQueryParams({view}), limit: QUERY_EMBED_ROW_LIMIT}
        : undefined,
    [view]
  );

  return (
    <QueryEmbedCard
      href={href}
      icon={IconStar}
      linkLabel={t('View Issues')}
      query={view?.query}
      table={
        !isError && view && queryParams ? (
          <QueryEmbedIssueList
            query={view.query}
            queryParams={queryParams}
            source="seer-saved-issue-view-embed"
          />
        ) : null
      }
      testId="seer-saved-issue-view-embed"
      title={view?.name ?? name ?? t('Issue view %s', id)}
    >
      {isPending ? (
        <Flex justify="center">
          <LoadingIndicator mini />
        </Flex>
      ) : isError || !view || !queryParams ? (
        <Text variant="muted">{t('Unable to load saved issue view.')}</Text>
      ) : null}
    </QueryEmbedCard>
  );
}

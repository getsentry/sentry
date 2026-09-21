import {lazy, useMemo} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

interface IssueEmbedProps {
  id: string;
  shortId?: string;
}

function IssueLink({format, id, shortId}: IssueEmbedProps & ResourceLinkFormatProps) {
  return (
    <ResourceLink
      format={format}
      icon={IconIssues}
      href={`/issues/${id}/`}
      title={shortId ?? id}
    />
  );
}

/**
 * `issue:` resolves short IDs only, so a numeric group ID has to go through
 * `issue.id:` or the issue search rejects the query outright. Seer is asked for
 * both, but only the numeric ID is guaranteed to be there.
 */
function issueQuery({id, shortId}: IssueEmbedProps) {
  if (shortId) {
    return `issue:${shortId}`;
  }
  return /^\d+$/.test(id) ? `issue.id:${id}` : `issue:${id}`;
}

function SingleIssueBlock({id, shortId}: IssueEmbedProps) {
  const queryParams = useMemo(
    () => ({query: issueQuery({id, shortId}), limit: '1'}),
    [id, shortId]
  );

  return (
    <LazyLoad
      LazyComponent={LazyGroupList}
      queryParams={queryParams}
      withChart
      withColumns={[]}
      withHeader={false}
      withPagination={false}
      canSelectGroups={false}
      useFilteredStats={false}
      numPlaceholderRows={1}
    />
  );
}

export const Issue = defineSeerEmbed({
  name: 'issue',
  render({id, shortId}, level) {
    switch (level) {
      case 'block':
        return <SingleIssueBlock id={id} shortId={shortId} />;
      case 'markdown':
        return <IssueLink id={id} shortId={shortId} format="markdown" />;
      case 'inline':
        return <IssueLink id={id} shortId={shortId} />;
    }
  },
});

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

function IssueLink({format, id}: {id: string} & ResourceLinkFormatProps) {
  return (
    <ResourceLink format={format} icon={IconIssues} href={`/issues/${id}/`} title={id} />
  );
}

function SingleIssueBlock({id}: {id: string}) {
  const queryParams = useMemo(() => ({query: `issue:${id}`, limit: '1'}), [id]);

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
  render({id}, level) {
    switch (level) {
      case 'block':
        return <SingleIssueBlock id={id} />;
      case 'markdown':
        return <IssueLink id={id} format="markdown" />;
      case 'inline':
        return <IssueLink id={id} />;
    }
  },
});

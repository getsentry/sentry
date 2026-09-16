import {lazy, useMemo} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

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
    if (level === 'block') {
      return <SingleIssueBlock id={id} />;
    }
    return <ResourceLink icon={IconIssues} href={`/issues/${id}/`} title={id} />;
  },
});

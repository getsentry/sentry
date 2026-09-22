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

/** A group ID is all digits; a short ID always carries its project slug. */
function isGroupId(value: string) {
  return /^\d+$/.test(value);
}

/**
 * Seer is asked for the group ID in `id` and the short ID in `shortId`, but it
 * emits ids loosely: bare numbers, or the group ID under `shortId`. Settle both
 * once here so nothing downstream has to ask what shape it was handed.
 */
function normalizeIds({id, shortId}: {id: string | number; shortId?: string}) {
  // A numeric `shortId` is the group ID under the wrong name. Dropping it beats
  // passing it to `issue:`, which resolves short IDs only and would reject it.
  return {
    id: String(id),
    shortId: shortId && !isGroupId(shortId) ? shortId : undefined,
  };
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

/** `issue:` resolves short IDs only, so a group ID has to go through `issue.id:`. */
function issueQuery({id, shortId}: IssueEmbedProps) {
  if (shortId) {
    return `issue:${shortId}`;
  }
  return isGroupId(id) ? `issue.id:${id}` : `issue:${id}`;
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
  render(props, level) {
    const {id, shortId} = normalizeIds(props);

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

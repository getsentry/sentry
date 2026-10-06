import {lazy, useMemo} from 'react';
import styled from '@emotion/styled';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';

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

/** Shared by the inline link and the block's header link, so the two cannot drift. */
function getIssueHref(id: string): string {
  return `/issues/${id}/`;
}

/**
 * What a reader should see the issue called: the short ID when Seer sent one,
 * the group ID only as a fallback. Shared so the inline link and the block's
 * heading name the same issue the same way.
 */
function getIssueTitle({id, shortId}: IssueEmbedProps): string {
  return shortId ?? id;
}

function IssueLink({format, id, shortId}: IssueEmbedProps & ResourceLinkFormatProps) {
  return (
    <ResourceLink
      format={format}
      icon={IconIssues}
      href={getIssueHref(id)}
      title={getIssueTitle({id, shortId})}
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
    // Left expanded, the card's default: one row, with nothing worth hiding
    // behind a closed panel.
    <SeerEmbedBlock
      href={getIssueHref(id)}
      icon={IconIssues}
      linkLabel={t('View Issue')}
      padding="0"
      testId="seer-issue-embed"
      title={getIssueTitle({id, shortId})}
    >
      <FlushPreview>
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
      </FlushPreview>
    </SeerEmbedBlock>
  );
}

/**
 * The issue row sits flush in the card: the card's own border already frames
 * it, so `GroupList`'s panel border, rounding, and trailing margin would only
 * draw a second box inside the first. A direct-child selector rather than
 * `${Panel}`, because `GroupList` renders a `styled(Panel)` whose class no
 * longer carries `Panel`'s own selector target.
 */
const FlushPreview = styled('div')`
  > div {
    border: 0;
    border-radius: 0;
    margin-bottom: 0;
  }
`;

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
